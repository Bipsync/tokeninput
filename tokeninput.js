( function( global ) {

    function T( inputElement, options ) {

        this.options = options = this._merge( {

            debug : false,

            namespace : null, // string or function to namespace element classes
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
                return { text : '"' + text + '"', value : text, freeText : true, group : 'freeText' }; },
            freeTextCompletion : function( text ) {
                return { text : '"' + text + '"', value : text, freeText : true, group : 'freeText' }; },
            willShowFreeTextCompletion : function( text, completions ) {
                return ( text.length && completions.length > 1 );
            },
            inlineTokenTrigger : {
                regExp : /[@#]([^@#]+)$/,
                matchOffset : 1
            },

            autoSelectSingleCompletions : true,
            positionFloatingElement : null, /* function( floatingElement ){} */
            floatingElementParent : null,
            removeOnlyCompletionsListElement : false,
            beforeEnter : null,
            beforeCompletionClick : null,
            hintElement : null,
            scrollingContainerClassName : null,
            hintAfterAdd : false,
            disableTokenClick : false,
            disableFocusOnTokenClick : false,
            disableFocusOnRemove : false,
            placeholderLength : null,
            focusAfterAdd : true,

            completionsForText : function( /* text, delayedCompletionsId, delayedCompletionsFn */ ) { return []; },
            completionClassNames : function( /* datum */ ) { return []; },
            completionFormatter : function( /* datum, element */ ) {},
            completionGroupClassNames : function( completionGroup ) { return [
                completionGroup.id
            ]; },
            completionGroupHeadingClassNames : function( /* completionGroup */ ) { return []; },
            completionGroups : {},
            newCompletionOption : function( group/*, text */ ) {
                return {
                    text : '+ New' + ( group.singular ? ' ' + group.singular : '' ) + '…'
                };
            }

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
                    var beforeFn = 'before' + index;
                    if ( this.options[ beforeFn ] ) {
                        if ( this.options[ beforeFn ]( e ) === false ) {
                            handled = true;
                        }
                    }
                    if ( !handled ) {
                        this[ fn ]( e );
                        handled = true;
                    }
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

                if ( !( this.options.disableFocusOnTokenClick && $( event.target ).closest( '.token' ).length > 0 ) ) {
                    this.inputElement.focus();
                }

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

            const eventIsTokenRemove = ( event.relatedTarget && event.relatedTarget.className === this.namespace( 'x' ) ) ||
                    ( event.relatedTarget && event.relatedTarget.lastChild && event.relatedTarget.lastChild.className === 'x' );

            if ( event.relatedTarget && ( event.target == event.relatedTarget || event.relatedTarget.contains( event.target ) ) ) {
                // allow click & drag of scrollbars etc
                event.relatedTarget.addEventListener( 'blur', () => {
                    setTimeout( function() {
                        this.clearNonInlineInputElementValue();
                        this.removeFloatingElement();
                    }.bind( this ), 100 );
                }, {
                    once : true
                } );
                return;
            }

            if ( this.options.disableTokenClick && eventIsTokenRemove ) {

                setTimeout( function() {
                    this.showHintElement();
                }.bind( this ), 0 );

            } else if ( !eventIsTokenRemove ) {

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
            var allElements = this.floatingElement.getElementsByClassName( this.namespace( 'completion' ) );
            if ( this.selectedCompletionIndex === undefined ) {
                if ( this.completionsAboveInput ) {
                    e.preventDefault();
                    this.selectedCompletionIndex = this.completionElements.indexOf( allElements[ allElements.length - 1 ] );
                    this.selectCompletion();
                }
            }
            else {
                var currentElement = this.completionElements[ this.selectedCompletionIndex ];
                var currentIndex = Array.prototype.indexOf.call( allElements, currentElement );
                var previousElement = allElements[ currentIndex - 1 ];

                if ( previousElement ) {
                    e.preventDefault();
                    this.deselectCompletion();
                    this.selectedCompletionIndex = this.completionElements.indexOf( previousElement );
                    this.selectCompletion();
                }
            }
        }
        else if ( this.completionsAboveInput ) {
            e.preventDefault();
        }
    };

    T.prototype.onDown = function( e ) {

        if ( this.completions.length ) {

            var allElements = this.floatingElement.getElementsByClassName( this.namespace( 'completion' ) );

            if ( this.selectedCompletionIndex === undefined ) {
                if ( !this.completionsAboveInput ) {
                    e.preventDefault();
                    this.selectedCompletionIndex = this.completionElements.indexOf( allElements[ 0 ] );
                    this.selectCompletion();
                }
            }
            else {
                var currentElement = this.completionElements[ this.selectedCompletionIndex ];
                var currentIndex = Array.prototype.indexOf.call( allElements, currentElement );
                var nextElement = allElements[ currentIndex + 1 ];

                if ( nextElement && nextElement.offsetParent ) {
                    e.preventDefault();
                    this.deselectCompletion();
                    this.selectedCompletionIndex = this.completionElements.indexOf( nextElement );
                    this.selectCompletion();
                }
            }
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

            if ( this.options.readOnly ) {
                this.deselectToken();
                return;
            }

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
        element.className = this.namespace( 'floating' );
        element.style.overflow = 'hidden';

        var removeElement = this._createRemoveElement();
        this.addEventListener( removeElement, 'click', this.onRemoveFloatingElementClick.bind( this ) );
        element.appendChild( removeElement );

        if ( this.elementBeforeCompletions ) {
            element.appendChild( this.elementBeforeCompletions );
        }

        var containerElement = this.completionsListElement = document.createElement( 'div' );
        containerElement.className = this.namespace( 'container' );

        var listElement = this.completionsListElement = document.createElement( 'div' );
        listElement.className = this.namespace( 'list' );
        containerElement.appendChild( listElement );

        if ( this.elementAfterCompletions ) {
            containerElement.appendChild( this.elementAfterCompletions );
        }

        element.appendChild( containerElement );

        var floatingElementParent = ( this.options.floatingElementParent || this.inputElement.parentNode );
        if ( typeof floatingElementParent == 'function' ) {
            floatingElementParent = floatingElementParent();
        }
        floatingElementParent.appendChild( element );

        this.floatingElement = element;

        this.scrollingContainer = this.options.scrollingContainerClassName ?
            this.floatingElement.getElementsByClassName( this.options.scrollingContainerClassName )[ 0 ] : this.floatingElement;
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
        if ( !completions.length ) {
            if ( this.options.footerText || this.elementAfterCompletions ) {
                this.setupFloatingElement();
                this.positionFloatingElement();
            }
            return;
        }

        this.setupFloatingElement();

        completions.forEach( function( datum ) {

            var containerElement = this.containerElementForCompletion( datum );

            var element = document.createElement( 'div' );
            element.style.display = 'block';
            element.className =
                [ this.namespace( 'completion' ) ].concat( this.options.completionClassNames( datum ) ).join( ' ' );
            element.textContent = datum.text;
            if ( this.options.completionFormatter ) {
                this.options.completionFormatter( datum, element );
            }
            this.addEventListener( element, 'mousedown', function( e ) {

                e.preventDefault();
                this.onCompletionClick( element, e );
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
                [ this.namespace( 'group' ) ].concat( this.options.completionGroupClassNames( completionGroup ) ).join( ' ' );

            if ( completionGroup.heading ) {
                var heading = document.createElement( 'div' );
                heading.className =
                    [ this.namespace( 'heading' ) ].concat( this.options.completionGroupHeadingClassNames( completionGroup ) ).join( ' ' );
                heading.textContent = completionGroup.heading;

                if ( completionGroup.label ) {
                    var span = document.createElement( 'span' )
                    span.className = 'label';
                    span.textContent = completionGroup.label;
                    heading.appendChild( span );
                }
                containerElement.appendChild( heading );
            }

            this.completionsListElement.appendChild( containerElement );

            delete completionGroup.id;

        }
        return containerElement;

    };

    T.prototype.onCompletionClick = function( element, e ) {

        var handled = false;
        var index = this.completionElements.indexOf( element );
        if ( index != -1 ) {
            this.selectedCompletionIndex = index;
        }

        if ( this.options[ 'beforeCompletionClick' ] ) {
            if ( this.options[ 'beforeCompletionClick' ]( e, this.completions[ this.selectedCompletionIndex ] ) === false ) {
                handled = true;
            }
        }

        if ( !handled ) {
            this.addTokenFromSelectedCompletion();
        }

        if ( this.options.focusAfterAdd ) {
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

        if ( this.options.footerText && document.getElementsByClassName( this.namespace( 'footer' ) ).length === 0 ) {
            var footerElement = document.createElement( 'div' );
            footerElement.className = this.namespace( 'footer' );
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

        const element = this.completionElements[ this.selectedCompletionIndex ];
        if ( !element ) {
            return;
        }

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
            if ( e ) {
                elementTop += e.offsetTop;
                e = e.offsetParent;
            }
        }

        var topOffset = elementTop - this.scrollingContainer.scrollTop;
        if ( topOffset < 0 ) {
            this.scrollingContainer.scrollTop += topOffset;
        }
        else {
            var bottomOffset = ( elementTop + element.offsetHeight ) -
                ( this.scrollingContainer.scrollTop + this.scrollingContainer.offsetHeight );
            if ( bottomOffset > 0 ) {
                this.scrollingContainer.scrollTop += bottomOffset;
            }
        }
    };

    T.prototype.removeCompletions = function() {

        this.completions = [];
        this.completionElements = [];
        this.groupElements = {};
        delete this.selectedCompletionIndex;

        if ( this.options.removeOnlyCompletionsListElement ) {
            this.completionsListElement.parentNode.removeChild( this.completionsListElement );
        } else {
            this.removeFloatingElement();
        }

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
                [ this.namespace( 'token' ) ].concat( this.options.tokenClassNames( datum ) ).join( ' ' );

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
            if ( !this.options.readOnly && !datum.readOnly ) {
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
            } else {
                this.inputElement.blur();
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
            // try by ID
            if ( datum.id !== undefined ) {
                var tokenIndex = this.tokens.map( function( token ) { return token.id; } ).indexOf( datum.id );
            }

            if ( tokenIndex == -1 ) {
                return;
            }
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
        if ( element ) {
            element.classList.remove( 'selected' );
        }

    };

    T.prototype.getTokens = function() {

        return this.tokens.slice();

    };

    T.prototype.getSelectedCompletion = function() {

        if ( this.selectedCompletionIndex !== undefined ) {
            return this.completions[ this.selectedCompletionIndex ];
        }
        return undefined;

    };

    T.prototype.getSelectedCompletionElement = function() {

        if ( this.selectedCompletionIndex !== undefined ) {
            return this.completionElements[ this.selectedCompletionIndex ];
        }
        return undefined;

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
        element.className = this.namespace( 'x' );
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

        if ( this.options.hintElement ) {
            this.setupFloatingElement();

            if (this.elementAfterCompletions) {
                this.scrollingContainer.insertBefore( this.options.hintElement, this.elementAfterCompletions );
            } else {
                this.scrollingContainer.appendChild( this.options.hintElement );
            }
            this.options.hintElement.style.display = '';

            this.positionFloatingElement();
        }

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

    T.prototype.setElementAfterCompletions = function( elementAfterCompletions ) {

        this.elementAfterCompletions = elementAfterCompletions;

    };

    T.prototype.setElementBeforeCompletions = function( elementBeforeCompletions ) {

        this.elementBeforeCompletions = elementBeforeCompletions;

    };

    T.prototype.getScrollingContainer = function() {

        return this.scrollingContainer;

    };

    T.prototype.namespace = function( className ) {

        if ( typeof this.options.namespace == 'string' ) {
            className = this.options.namespace + className;
        }
        else if ( typeof this.options.namespace == 'function' ) {
            className = this.options.namespace( className );
        }
        return className;

    }

    T.prototype.setSelectedCompletion = function( completion ) {

        if ( this.selectedCompletionIndex !== undefined ) {
            this.deselectCompletion();
        }
        var index = this.completions.indexOf( completion );
        if ( index != -1 ) {
            this.selectedCompletionIndex = index;
            this.selectCompletion();
        }

    }

    //

    function TokenInput() {
    }

    global.TokenInput = function( element, options ) {

        var instance = new T( element, options ),
            exposed = new TokenInput();

        [
            'addEventListener',
            'getTokens',
            'getSelectedCompletion',
            'getSelectedCompletionElement',
            'setCompletionGroups',
            'setSelectedCompletion',
            'removeCompletions',
            'removeFloatingElement',
            'positionFloatingElement',
            'removeToken',
            'setTokens',
            'addToken',
            'didAddToken',
            'suggestCompletions',
            'setElementAfterCompletions',
            'setElementBeforeCompletions',
            'getScrollingContainer',
            'onUp',
            'onDown',
            'destroy'

        ].forEach( function( method ) {

            exposed[ method ] = instance[ method ].bind( instance );

        } );
        return exposed;

    };

} )( window );
