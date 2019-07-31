( function( global ) {

    function T( inputElement, options ) {

        this.options = options = this._merge( {

            debug : false,

            readOnly : false,
            tabToAdd : true,
            xHTML : '&times;',
            tokenClassNames : function( /* datum */ ) { return []; },
            tokenFormatter : function( /* datum, element */ ) {},
            inlineTokenFormatter : function( datum ) {
                return '<span contenteditable="false">' + datum.text + '</span>';
            },
            containerClickTriggersFocus : true,

            freeTextEnabled : false,
            freeTextToken : function( text ) {
                return { text : '"' + text + '"', value : text, freeText : true }; },
            freeTextCompletion : function( text ) {
                return { text : '"' + text + '"', value : text, freeText : true }; },
            willShowFreeTextCompletion : function( text, completions ) {
                return ( text.length && completions.length > 1 );
            },
            inlineTokenTrigger : {
                regExp : /[@#]([^@#]+)$/,
                matchOffset : 1
            },

            completionsForText : function( /* text, delayedCompletionsId, delayedCompletionsFn */ ) { return []; },
            completionClassNames : function( /* datum */ ) { return []; },
            completionFormatter : function( /* datum, element */ ) {},
            completionGroupClassNames : function( completionGroup ) { return [
                completionGroup.id
            ]; },
            completionGroupHeadingClassNames : function( /* completionGroup */ ) { return []; },
            autoSelectSingleCompletions : true,

            completionGroups : {},
            newCompletionOption : function( group/*, text */ ) {
                return {
                    text : '+ New' + ( group.singular ? ' ' + group.singular : '' ) + '…'
                };
            },

            positionFloatingElement : null, /* function( floatingElement ){} */
            floatingElementParent : null,

            hintElement : null,
            hintAfterAdd : false,
            disableTokenClick : false,
            disableFocusOnRemove : false,

            placeholderLength : null

        }, options || {} );

        this.completions = [];
        this.completionElements = [];
        this.groupElements = {};
        this.tokens = [];
        this.tokenElements = [];
        this.keys = {
            Up : 38,
            Down : 40,
            Escape : 27,
            Enter : 13,
            Left : 37,
            Right : 39,
            Backspace : 8,
            Tab : 9
        };
        this.willShowHintElement = true;
        this.eventListeners = [];
        this.inlineTokenMode = false;

        this.setupInputElement( inputElement );
        this.setupRepositionListeners();
        this.setTokens( this.options.data );
        this.setupTrace();

    }

    T.prototype.setupTrace = function() {

        for ( var key in this ) {
            var value = this[ key ];
            if ( typeof value == 'function' && key[ 0 ] != '_' ) {
                this[ key ] = this._traceFunction( value, key );
            }
        }

    };

    T.prototype._traceFunction = function( original, key ) {

        var stack = this._stack,
            debug = this.options.debug,
            debugColours = this._debugColours;

        if ( !stack ) {
            stack = this._stack = [];
        }
        if (
            !debugColours && (
                navigator.userAgent.toLowerCase().indexOf( 'chrome' ) > -1 ||
                navigator.userAgent.toLowerCase().indexOf( 'firefox' ) > -1
            )
        ) {
            debugColours = this._debugColours = [
                '#800', '#880', '#080', '#088', '#008', '#808',
            ];
        }
        return function() {

            var args = Array.prototype.slice.call( arguments ),
                call = key + '(' + ( args.length ? ' ' + args.join( ', ' ) + ' ' : '' ) + ')';

            stack.push( call );

            if ( debug ) {
                var log = Array( stack.length * 2 ).join( ' ' ) + call;
                if ( debugColours ) {
                    if ( stack.length == 1 ) {
                        debugColours.push( debugColours.shift() );
                    }
                    console.log( '%c ' + log, 'color: ' + debugColours[ 0 ] );
                }
                else {
                    console.log( log );
                }
            }

            var result = original.apply( this, arguments );

            stack.pop();

            return result;

        };

    };

    T.prototype.setupInputElement = function( element ) {

        this.inputElement = element;

        this.inlineTokenMode = ( element.contentEditable === 'true' );

        this.addEventListener( element, 'input', function() {

            this.onInput();

        }.bind( this ) );

        this.addEventListener( element, 'keydown', function( e ) {

            var handled = false;
            for ( var index in this.keys ) {
                var which = this.keys[ index ];
                if ( e.which == which ) {
                    var fn = 'on' + index;
                    this[ fn ]( e );
                    handled = true;
                    break;
                }
            }

            if ( handled ) {
                e.stopPropagation();
            }
            else {
                if ( this.selectedTokenIndex !== undefined ) {
                    this.deselectToken();
                    delete this.selectedTokenIndex;
                }
            }

        }.bind( this ) );

        if ( this.options.containerClickTriggersFocus ) {

            this.addEventListener( element.parentNode, 'click', function() {

                this.inputElement.focus();

            }.bind( this ) );

        }

        if ( this.options.hintElement ) {

            this.addEventListener( this.inputElement, 'focus', function() {

                if ( !this.willShowHintElement ) {
                    this.willShowHintElement = true;
                    return;
                }

                this.showHintElement();

            }.bind( this ) );

        }

        if ( this.options.readOnly ) {

            this.inputElement.setAttribute( 'readonly', 'readonly' );

        }

        if ( this.willAutoGrowInputElement() ) {
            this.autoGrowInputElement();
        }

        this.addEventListener( element, 'blur', function( event ) {

            if (
                this.options.disableTokenClick &&
                (
                    ( event.relatedTarget && event.relatedTarget.className === 'x' ) ||
                    ( event.relatedTarget && event.relatedTarget.lastChild && event.relatedTarget.lastChild.className === 'x' )
                )
            ) {

                setTimeout( function() {
                    this.showHintElement();
                }.bind( this ), 0 );

            } else {

                setTimeout( function() {
                    this.clearNonInlineInputElementValue();
                    this.removeFloatingElement();
                }.bind( this ), 100 );

            }

        }.bind( this ) );

    };

    T.prototype.onInput = function() {

        if ( this.inlineTokenMode ) {

            var selection = window.getSelection(),
                focusNode = selection.focusNode;

            if ( !selection.isCollapsed ) {
                return;
            }
            if ( focusNode == this.getInputElementValue() ) {
                return;
            }
            if ( focusNode.nodeType != Node.TEXT_NODE ) {
                return;
            }
            var textContent = focusNode.textContent;
            textContent = textContent.substr( 0, selection.focusOffset );

            var match = textContent.match( this.options.inlineTokenTrigger.regExp );
            if ( match && match[ this.options.inlineTokenTrigger.matchOffset ] ) {
                var text = match[ this.options.inlineTokenTrigger.matchOffset ];
                text = text.trim();
                this.suggestCompletions( {
                    text : text
                } );
                if ( this.willAutoGrowInputElement() ) {
                    this.autoGrowInputElement();
                }
            }
            else {
                this.removeFloatingElement();
            }

        } else {
            this.suggestCompletions();
            if ( this.willAutoGrowInputElement() ) {
                this.autoGrowInputElement();
            }
        }

    };

    T.prototype.onUp = function( e ) {

        if ( this.completions.length ) {
            if ( this.selectedCompletionIndex === undefined ) {
                if ( this.completionsAboveInput ) {
                    e.preventDefault();
                    this.selectedCompletionIndex = this.completions.length - 1;
                    this.selectCompletion();
                }
            }
            else if ( this.selectedCompletionIndex === 0 ) {
                e.preventDefault();
            }
            else if ( this.selectedCompletionIndex > 0 ) {
                e.preventDefault();
                this.deselectCompletion();
                this.selectedCompletionIndex--;
                this.selectCompletion();
            }
        }
        else if ( this.completionsAboveInput ) {
            e.preventDefault();
            this.suggestCompletions();
        }

    };

    T.prototype.onDown = function( e ) {

        if ( this.completions.length ) {
            if ( this.selectedCompletionIndex === undefined ) {
                if ( !this.completionsAboveInput ) {
                    e.preventDefault();
                    this.selectedCompletionIndex = 0;
                    this.selectCompletion();
                }
            }
            else if ( this.selectedCompletionIndex < this.completions.length - 1 ) {
                e.preventDefault();
                this.deselectCompletion();
                this.selectedCompletionIndex++;
                this.selectCompletion();
            }
        }
        else {
            e.preventDefault();
            this.suggestCompletions();
        }

    };

    T.prototype.onEscape = function() {

        if ( this.selectedCompletionIndex !== undefined ) {
            this.deselectCompletion();
            delete this.selectedCompletionIndex;
        }
        else if ( this.completions.length ) {
            this.removeCompletions();
        }
        else if ( this.selectedTokenIndex !== undefined ) {
            this.deselectToken();
            delete this.selectedTokenIndex;
        }
        else if ( this.getInputElementValue().length ) {
            this.clearNonInlineInputElementValue();
        }
        else if ( this.floatingElement ) {
            this.removeFloatingElement();
        }

    };

    T.prototype.onEnter = function( e ) {

        if ( this.selectedCompletionIndex !== undefined ) {
            e.preventDefault();
            this.addTokenFromSelectedCompletion();
        }
        else if ( !this.inlineTokenMode && this.options.freeTextEnabled !== false && this.getInputElementValue().length ) {
            e.preventDefault();
            this.addTokenFromInputElement();
        }

    };

    T.prototype.onLeft = function( e ) {

        if ( this.completions.length ) {
            this.removeCompletions();
        }

        if (
            this.tokens.length &&
            this.inputElement.selectionStart === 0 &&
            this.inputElement.selectionEnd === 0 &&
            this.getInputElementValue().length === 0
        ) {
            e.preventDefault();
            if ( this.selectedTokenIndex !== undefined ) {
                if ( this.selectedTokenIndex > 0 ) {
                    this.deselectToken();
                    this.selectedTokenIndex--;
                }
            }
            else {
                this.selectedTokenIndex = this.tokens.length - 1;
            }
            this.selectToken();
        }

    };

    T.prototype.onRight = function( e ) {

        if ( this.completions.length ) {
            this.removeCompletions();
        }

        if (
            this.selectedTokenIndex !== undefined &&
            this.getInputElementValue().length === 0
        ) {
            e.preventDefault();
            if ( this.selectedTokenIndex < this.tokens.length - 1 ) {
                this.deselectToken();
                this.selectedTokenIndex++;
                this.selectToken();
            }
            else {
                this.deselectToken();
                delete this.selectedTokenIndex;
            }
        }

    };

    T.prototype.onBackspace = function( e ) {

        if (
            this.selectedTokenIndex !== undefined &&
            this.getInputElementValue().length === 0
        ) {
            e.preventDefault();

            this.removeSelectedToken();

            if ( !this.tokens.length ) {
                delete this.selectedTokenIndex;
                return;
            }

            if ( this.selectedTokenIndex == this.tokens.length ) {
                delete this.selectedTokenIndex;
                return;
            }
            this.selectToken();

        }
        else if (
            this.selectedTokenIndex === undefined &&
            this.tokens.length &&
            this.inputElement.selectionStart === 0 &&
            this.inputElement.selectionEnd === 0
        ) {

            e.preventDefault();

            this.selectedTokenIndex = this.tokens.length - 1;
            this.selectToken();

        }
        else if ( this.inlineTokenMode ) {

            var selection = window.getSelection(),
                range = selection.getRangeAt( 0 ),
                container = range.startContainer,
                potentialChild;

            if ( container == this.inputElement ) {
                potentialChild = container.lastChild;
            }
            else if ( container.previousSibling ) {
                container = container.parentNode;
                potentialChild = container.previousSibling;
            }

            if ( this.tokenElements.indexOf( potentialChild ) !== -1 ) {

                e.preventDefault();

                container.removeChild( potentialChild );

                this.selectedTokenIndex = this.tokenElements.indexOf( potentialChild );
                this.removeSelectedToken();
                delete this.selectedTokenIndex;

            }

        }

    };

    T.prototype.removeFloatingElement = function() {

        if ( this.floatingElement ) {
            this.dispatchEvent( 'willHideFloatingElement' );
            this.floatingElement.parentNode.removeChild( this.floatingElement );
            delete this.floatingElement;
            this.dispatchEvent( 'didHideFloatingElement' );
        }

    };

    T.prototype.setupFloatingElement = function() {

        this.removeFloatingElement();

        var element = document.createElement( 'div' );
        element.className = 'floating';
        element.style.overflow = 'hidden';

        var removeElement = this._createRemoveElement();
        this.addEventListener( removeElement, 'click', this.onRemoveFloatingElementClick.bind( this ) );
        element.appendChild( removeElement );

        var listElement = this.completionsListElement = document.createElement( 'div' );
        listElement.className = 'list';
        element.appendChild( listElement );

        var floatingElementParent = ( this.options.floatingElementParent || this.inputElement.parentNode );
        if ( typeof floatingElementParent == 'function' ) {
            floatingElementParent = floatingElementParent();
        }
        floatingElementParent.appendChild( element );

        this.floatingElement = element;

    };

    T.prototype.onRemoveFloatingElementClick = function( e ) {

        this.removeFloatingElement();

        this.willShowHintElement = false;

        e.preventDefault();
        return false;

    };

    T.prototype.suggestCompletions = function( options ) {

        options = options || {};

        this.nextDelayedCompletionsId = this.nextDelayedCompletionsId || 0;

        var text = options.text || this.getInputElementValue(),
            completions = options.completions ? options.completions.slice( 0 ) :
                this.options.completionsForText( text, ++this.nextDelayedCompletionsId,
                    function( delayedCompletionsId, delayedCompletions ) {

                        if ( delayedCompletionsId != this.nextDelayedCompletionsId ) {
                            return;
                        }

                        this.suggestCompletions(
                            {
                                completions : delayedCompletions,
                                preserveSelection : true,
                                text : text
                            }
                        );

                    }.bind( this ) ).slice( 0 );

        this.receivedCompletions = completions.slice( 0 );

        if (
            this.options.freeTextEnabled &&
            this.options.freeTextCompletion &&
            this.options.willShowFreeTextCompletion( text, completions )
        ) {
            completions.unshift( this.options.freeTextCompletion( text ) );
        }

        if ( text.length ) {
            for ( var groupId in this.options.completionGroups ) {
                var group = this.options.completionGroups[ groupId ];
                if ( group.newOption ) {
                    this.insertNewOptionForGroup( groupId, group, completions, text );
                }
            }
        }

        var selectedCompletion;
        if ( this.selectedCompletionIndex !== undefined && options.preserveSelection ) {
            selectedCompletion = this.completions[ this.selectedCompletionIndex ];
        }

        this.displayCompletions( completions );

        if ( selectedCompletion !== undefined && options.preserveSelection ) {
            this.selectedCompletionIndex = this.completions.indexOf( selectedCompletion );
            if ( this.selectedCompletionIndex == -1 ) {
                delete this.selectedCompletionIndex;
            }
            else {
                this.selectCompletion();
            }
        }

        if ( this.selectedCompletionIndex === undefined ) {
            if ( this.options.autoSelectSingleCompletions && this.receivedCompletions.length == 1 ) {
                this.selectedCompletionIndex = 0;
                this.selectCompletion();
            }
            else {
                for ( var index in this.completions ) {
                    var completion = this.completions[ index ];
                    if ( completion.select ) {
                        this.selectedCompletionIndex = index;
                        this.selectCompletion();
                        break;
                    }
                }
            }
        }

    };

    T.prototype.insertNewOptionForGroup = function( groupId, group, completions, text ) {

        var insertIndex;
        completions.forEach( function( completion, completionIndex ) {
            if ( completion.group == groupId ) {
                insertIndex = completionIndex + 1;
            }
        }, this );

        var newOption = this.options.newCompletionOption( group, text );
        newOption.newOption = text;
        newOption.group = groupId;

        if ( insertIndex !== undefined ) {
            completions.splice( insertIndex, 0, newOption );
        }
        else {
            completions.push( newOption );
        }

    };

    T.prototype.displayCompletions = function( completions ) {

        if ( this.completions.length ) {
            this.removeCompletions();
        }

        this.completions = completions;
        if ( !completions.length && !this.options.footerText ) {
            return;
        }

        this.setupFloatingElement();

        completions.forEach( function( datum ) {

            var containerElement = this.containerElementForCompletion( datum );

            var element = document.createElement( 'a' );
            element.style.display = 'block';
            element.className =
                [ 'completion' ].concat( this.options.completionClassNames( datum ) ).join( ' ' );
            element.textContent = datum.text;
            if ( this.options.completionFormatter ) {
                this.options.completionFormatter( datum, element );
            }
            this.addEventListener( element, 'mousedown', function( e ) {

                e.preventDefault();
                this.onCompletionClick( element );
                return false;

            }.bind( this ) );
            containerElement.appendChild( element );

            this.completionElements.push( element );

        }, this );

        this.positionFloatingElement();

    };

    T.prototype.containerElementForCompletion = function( datum ) {

        var containerElement = this.completionsListElement,
            datumGroup = datum.displayGroup || datum.group;
        if ( !datumGroup ) {
            return containerElement;
        }

        var completionGroup = this.options.completionGroups[ datumGroup ];
        if ( !completionGroup ) {
            return containerElement;
        }

        containerElement = this.groupElements[ datumGroup ];
        if ( !containerElement ) {

            completionGroup.id = datumGroup;

            containerElement = this.groupElements[ datumGroup ] = document.createElement( 'div' );
            containerElement.className =
                [ 'group' ].concat( this.options.completionGroupClassNames( completionGroup ) ).join( ' ' );

            if ( completionGroup.heading ) {
                var heading = document.createElement( 'div' );
                heading.className =
                    [ 'heading' ].concat( this.options.completionGroupHeadingClassNames( completionGroup ) ).join( ' ' );
                heading.textContent = completionGroup.heading;
                containerElement.appendChild( heading );
            }

            this.completionsListElement.appendChild( containerElement );

            delete completionGroup.id;

        }
        return containerElement;

    };

    T.prototype.onCompletionClick = function( element ) {

        var index = this.completionElements.indexOf( element );
        if ( index != -1 ) {

            this.selectedCompletionIndex = index;
            this.addTokenFromSelectedCompletion();

            this.inputElement.focus();

        }

    };

    T.prototype.positionFloatingElement = function() {

        if ( !this.floatingElement ) {
            return;
        }

        this.dispatchEvent( 'willShowFloatingElement' );

        if ( this.options.positionFloatingElement ) {
            this.options.positionFloatingElement( this.floatingElement );
            this.dispatchEvent( 'didShowFloatingElement' );
            return;
        }

        this.floatingElement.style.display = 'inline-block';
        this.floatingElement.style.position = 'absolute';

        var element = this.inputElement,
            inputLeft = 0,
            inputTop = 0;

        while ( element ) {
            if ( /^(absolute|relative)$/.test(
                    document.defaultView.getComputedStyle( element, null ).getPropertyValue( 'position' )
                ) ) {
                break;
            }
            inputLeft += element.offsetLeft;
            inputTop += element.offsetTop;
            element = element.offsetParent;
        }

        this.floatingElement.style.left = inputLeft + 'px';
        this.floatingElement.style.right = 'auto';
        this.floatingElement.style.top = inputTop + this.inputElement.offsetHeight + 'px';
        this.floatingElement.style.bottom = 'auto';

        this.completionsAboveInput = false;

        var rect = this.floatingElement.getBoundingClientRect();
        if ( rect.bottom > document.documentElement.clientHeight ) {

            var previousTop = this.floatingElement.style.top;
            this.floatingElement.style.top = inputTop - ( rect.height ) + 'px';
            var newRect = this.floatingElement.getBoundingClientRect();
            if ( newRect.top < 0 ) {

                this.floatingElement.style.top = previousTop;
                this.floatingElement.style.height = ( document.documentElement.clientHeight - rect.top - 20 ) + 'px';
                this.floatingElement.style.overflowY = 'scroll';

            }
            else {
                this.completionsAboveInput = true;
            }

        }
        if ( rect.right > document.documentElement.clientWidth ) {

            this.floatingElement.style.left = 'auto';
            this.floatingElement.style.right = '0';

        }

        if ( this.options.footerText && document.getElementsByClassName( 'tokenInputFooter' ).length === 0 ) {
            var footerElement = document.createElement( 'div' );
            footerElement.className = 'tokenInputFooter';
            footerElement.innerText = this.options.footerText;
            this.floatingElement.appendChild( footerElement );
        }

        this.dispatchEvent( 'didShowFloatingElement' );

    };

    T.prototype.deselectCompletion = function() {

        var element = this.completionElements[ this.selectedCompletionIndex ];
        element.classList.remove( 'selected' );

        element.parentNode.classList.remove( 'hasSelected' );
        element.parentNode.classList.remove( 'hasSelectedFirst' );

    };

    T.prototype.selectCompletion = function() {

        var element = this.completionElements[ this.selectedCompletionIndex ];
        element.classList.add( 'selected' );

        element.parentNode.classList.add( 'hasSelected' );
        if ( this.completionElements.indexOf( element.previousSibling ) === -1 ) {
            element.parentNode.classList.add( 'hasSelectedFirst' );
        }

        if ( !this.floatingElement ) {
            return;
        }

        var elementTop = 0,
            e = element;
        while ( e != this.floatingElement ) {
            elementTop += e.offsetTop;
            e = e.offsetParent;
        }

        var topOffset = elementTop - this.floatingElement.scrollTop;
        if ( topOffset < 0 ) {
            this.floatingElement.scrollTop += topOffset;
        }
        else {
            var bottomOffset = ( elementTop + element.offsetHeight ) -
                ( this.floatingElement.scrollTop + this.floatingElement.offsetHeight );
            if ( bottomOffset > 0 ) {
                this.floatingElement.scrollTop += bottomOffset;
            }
        }

    };

    T.prototype.removeCompletions = function() {

        this.completions = [];
        this.completionElements = [];
        this.groupElements = {};
        delete this.selectedCompletionIndex;

        this.removeFloatingElement();

    };

    T.prototype.addTokenFromSelectedCompletion = function() {

        var suggestion = this.completions[ this.selectedCompletionIndex ];

        if ( suggestion.newOption ) {
            suggestion.text = suggestion.newOption;
            delete suggestion.newOption;
        }

        this.addToken( suggestion );

        this.didAddToken();

    };

    T.prototype.addTokenFromInputElement = function() {

        this.addToken( this.options.freeTextToken( this.getInputElementValue() ) );

        this.didAddToken();

    };

    T.prototype.didAddToken = function() {

        this.clearNonInlineInputElementValue();

        if ( this.completions.length ) {
            this.removeCompletions();
        }

        if ( this.options.hintElement && this.options.hintAfterAdd ) {
            this.showHintElement();
        }

    };

    T.prototype.addToken = function( datum, options ) {

        options = options || {};

        if ( !options.silent ) {
            this.dispatchEvent( 'willAdd', datum );
            if ( datum.abortAdd ) {
                return;
            }
        }

        var element;
        if ( this.inlineTokenMode ) {

            element = document.createElement( 'div' );
            element.innerHTML = this.options.inlineTokenFormatter( datum );
            element = element.firstChild;

        }
        else {

            element = document.createElement( 'div' );
            element.style.display = 'inline-block';
            element.tabIndex = -1;
            element.className =
                [ 'token' ].concat( this.options.tokenClassNames( datum ) ).join( ' ' );

            element.textContent = datum.text;
            if ( this.options.tokenFormatter ) {
                this.options.tokenFormatter( datum, element );
            }

        }

        if ( !this.options.disableTokenClick ) {
            this.addEventListener( element, 'click', this.onTokenClick.bind( this ) );
        }

        if ( this.inlineTokenMode ) {

            var selection = window.getSelection(),
                range = selection.getRangeAt( 0 );

            var emptyNode = document.createTextNode( '\u00A0' );
            range.insertNode( emptyNode );

            range.insertNode( element );

            var selectionNode = selection.anchorNode;
            selectionNode.textContent = selectionNode.textContent.replace(
                this.options.inlineTokenTrigger.regExp, '' );

            selection.removeAllRanges();

            range = document.createRange();
            range.selectNode( emptyNode );
            range.collapse( true );
            selection.addRange( range );

        }
        else {
            if ( !this.options.readOnly ) {
                var removeElement = this._createRemoveElement();
                this.addEventListener( removeElement, 'click', this.onRemoveTokenClick.bind( this ) );
                element.appendChild( removeElement );
            }

            if ( options.index !== undefined ) {
                var before = this.tokenElements[ options.index ];
                if ( !before ) {
                    before = this.inputElement;
                }
                this.inputElement.parentNode.insertBefore( element, before );
            }
            else {
                this.inputElement.parentNode.insertBefore( element, this.inputElement );
            }
        }

        this.tokenElements.push( element );

        this.tokens.push( datum );

        if ( !options.silent ) {
            this.dispatchEvent( 'change' );
            this.dispatchEvent( 'add', datum );
        }

    };

    T.prototype.onTokenClick = function( e ) {

        var tokenElements = this.tokenElements,
            index = tokenElements.indexOf( e.target );

        tokenElements.forEach( function( el ) {
            if ( el.contains( e.target ) ) {
                index = tokenElements.indexOf( el );
            }
        }, this );

        if ( index != -1 ) {

            if ( this.completions.length ) {
                this.removeCompletions();
            }

            if ( this.selectedTokenIndex !== undefined ) {
                this.deselectToken();
            }
            this.selectedTokenIndex = index;
            this.selectToken();

            this.clearNonInlineInputElementValue();
            this.inputElement.focus();

            var token = this.tokens[ this.selectedTokenIndex ];
            this.dispatchEvent( 'tokenClicked', {
                datum : token,
                element : e.target
            } );

        }

        e.preventDefault();
        return false;

    };

    T.prototype.onRemoveTokenClick = function( e ) {

        var tokenElements = this.tokenElements,
            index = tokenElements.indexOf( e.target.parentNode );
        if ( index != -1 ) {

            if ( this.completions.length ) {
                this.removeCompletions();
            }

            this.selectedTokenIndex = index;
            this.removeSelectedToken();
            delete this.selectedTokenIndex;

            if ( !this.options.disableFocusOnRemove ) {
                this.inputElement.focus();
            }

        }

        e.preventDefault();
        e.stopPropagation();
        return false;

    };

    T.prototype.selectToken = function() {

        var element = this.tokenElements[ this.selectedTokenIndex ];
        element.classList.add( 'selected' );

    };

    T.prototype.removeSelectedToken = function( options ) {

        options = options || {};

        var selectedTokenIndex = this.selectedTokenIndex,
            tokenElement = this.tokenElements.splice( selectedTokenIndex, 1 )[ 0 ];

        if ( tokenElement.parentNode ) {
            tokenElement.parentNode.removeChild( tokenElement );
        }

        var removedToken = this.tokens.splice( selectedTokenIndex, 1 )[ 0 ];

        this.dispatchEvent( 'change' );
        this.dispatchEvent( 'remove', removedToken );
        if ( this.willAutoGrowInputElement() ) {
            this.autoGrowInputElement();
        }
    };

    T.prototype.removeToken = function( datum, options ) {

        options = options || {};

        var tokenIndex = this.tokens.indexOf( datum );
        if ( tokenIndex == -1 ) {
            return;
        }

        var tokenElement = this.tokenElements.splice( tokenIndex, 1 )[ 0 ];

        if ( tokenElement.parentNode ) {
            tokenElement.parentNode.removeChild( tokenElement );
        }

        var removedToken = this.tokens.splice( tokenIndex, 1 )[ 0 ];

        if ( !options.silent ) {
            this.dispatchEvent( 'change' );
            this.dispatchEvent( 'remove', removedToken );
        }
        if ( this.willAutoGrowInputElement() ) {
             this.autoGrowInputElement();
        }

    };

    T.prototype.deselectToken = function() {

        var element = this.tokenElements[ this.selectedTokenIndex ];
        element.classList.remove( 'selected' );

    };

    T.prototype.getTokens = function() {

        return this.tokens.slice();

    };

    T.prototype.dispatchEvent = function( eventName, detail ) {

        var event;
        try {
            event = new CustomEvent( eventName, {
                detail : detail
            } );
        }
        catch ( exception ) {
            event = document.createEvent( 'Event' );
            event.initEvent( eventName, true, true, detail );
        }

        this.inputElement.dispatchEvent( event );

    };

    T.prototype.onTab = function( e ) {

        if ( this.options.tabToAdd ) {
            this.onEnter( e );
        }

    };

    T.prototype._merge = function() {

        var result = {};
        for ( var argumentIndex in arguments ) {
            var object = arguments[ argumentIndex ];
            for ( var key in object ) {
                result[ key ] = object[ key ];
            }
        }
        return result;

    };

    T.prototype._createRemoveElement = function() {

        var element = document.createElement( 'a' );
        element.className = 'x';
        element.href = '#';
        element.tabIndex = -1;
        element.innerHTML = this.options.xHTML;
        element.style.textDecoration = 'none';
        return element;

    };

    T.prototype.setupRepositionListeners = function() {

        this.addEventListener( window, 'resize', this.positionFloatingElementAfterDelay.bind( this ) );
        this.addEventListener( window, 'scroll', this.positionFloatingElementAfterDelay.bind( this ) );

    };

    T.prototype.positionFloatingElementAfterDelay = function() {

        if ( this.positionFloatingElementTimeout ) {
            window.clearTimeout( this.positionFloatingElementTimeout );
        }
        this.positionFloatingElementTimeout = window.setTimeout( function() {
            if ( this.completions.length ) {
                this.positionFloatingElement();
            }
        }.bind( this ), 100 );

    };

    T.prototype.setTokens = function( newTokens ) {

        var existingTokens = this.tokens.slice(),
            existingToken;

        while ( ( existingToken = existingTokens.pop() ) ) {
            this.removeToken( existingToken, {
                silent : true
            } );
        }

        if ( newTokens ) {
            newTokens.forEach( function( datum ) {
                this.addToken( datum, {
                    silent : true
                } );
            }, this );
        }

    };

    T.prototype.showHintElement = function() {

        this.setupFloatingElement();

        this.floatingElement.appendChild( this.options.hintElement );
        this.options.hintElement.style.display = '';

        this.positionFloatingElement();

    };

    T.prototype.setCompletionGroups = function( completionGroups ) {

        this.options.completionGroups = completionGroups;

    };

    T.prototype.addEventListener = function( element, type, listener ) {

        this.eventListeners.push( [
            element, type, listener
        ] );
        element.addEventListener( type, listener );

    };

    T.prototype.willAutoGrowInputElement = function() {

        return !this.inlineTokenMode;

    };

    T.prototype.autoGrowInputElement = function() {

        var el = this.inputElement,
            placeholderLength = this.options.placeholderLength || el.placeholder.length,
            targetSize;
        if ( el.value.length && el.value.length > placeholderLength ) {
            targetSize = el.value.length;
        }
        else if ( placeholderLength ) {
            targetSize = placeholderLength;
        }
        if ( targetSize ) {
            el.size = targetSize + 1;
        }

    };

    T.prototype.destroy = function() {

        this.eventListeners
            .forEach( function( listener ) {
                if ( listener && listener[ 0 ] ) {
                    listener[ 0 ].removeEventListener( listener[ 1 ], listener[ 2 ] );
                }
            } );
        this.eventListeners = [];

    };

    T.prototype.getInputElementValue = function() {

        var propertyName = this.inlineTokenMode ? "innerHTML" : "value";
        return this.inputElement[ propertyName ];

    };

    T.prototype.setInputElementValue = function( value ) {

        var propertyName = this.inlineTokenMode ? "innerHTML" : "value";
        this.inputElement[ propertyName ] = value;

    };

    T.prototype.clearNonInlineInputElementValue = function() {

        if ( !this.inlineTokenMode ) {
            this.setInputElementValue( '' );
        }

    };

    //

    function TokenInput() {
    }

    global.TokenInput = function( element, options ) {

        var instance = new T( element, options ),
            exposed = new TokenInput();

        [
            'addEventListener',
            'getTokens',
            'setCompletionGroups',
            'removeFloatingElement',
            'positionFloatingElement',
            'removeToken',
            'setTokens',
            'onUp',
            'onDown',
            'destroy'

        ].forEach( function( method ) {

            exposed[ method ] = instance[ method ].bind( instance );

        } );
        return exposed;

    };

} )( window );
