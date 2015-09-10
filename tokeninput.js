( function( global ) {
    
    function T( inputElement, options ) {
        
        this.options = options = this._merge( {
            
            debug : false,
            
            undo : true,
            undoLimit : 10,
            tabToAdd : true,
            xHTML : '&#x2716;',
            tokenClassNames : function( /* datum */ ) { return []; },
            containerClickTriggersFocus : true,
            
            freeTextEnabled : false,
            freeTextToken : function( text ) { 
                return { text : '“' + text + '”', value : text, freeText : true }; },
            freeTextCompletion : function( text ) {
                return { text : '“' + text + '”', value : text, freeText : true }; },
            willShowFreeTextCompletion : function( text, completions ) {
                return ( text.length && completions.length > 1 );
            },
            
            completionsForText : function( /* text, delayedCompletionsId, delayedCompletionsFn */ ) { return []; },
            completionClassNames : function( /* datum */ ) { return []; },
            completionGroupClassNames : function( completionGroup ) { return [
                completionGroup.id
            ]; },
            completionGroupHeadingClassNames : function( /* completionGroup */ ) { return []; },
            autoSelectSingleCompletions : true,
            documentClickHidesCompletions : true,
            
            completionGroups : {},
            newCompletionOption : function( group/*, text */ ) {
                return {
                    text : '+ New' + ( group.singular ? ' ' + group.singular : '' ) + '…'
                };
            },
            
            positionFloatingElement : null, /* function( floatingElement ){} */
            
            hintElement : null,         
            hintAfterAdd : false
            
        }, options || {} );
        
        this.completions = [];
        this.completionElements = [];
        this.tokens = [];
        this.tokenElements = [];
        this.undoStack = [];    
        this.keys = {
            Up : 38,
            Down : 40,
            Escape : 27,
            Enter : 13,
            Left : 37,
            Right : 39,
            Backspace : 8,
            Z : 90,
            Tab : 9
        };
        this.willShowHintElement = true;
        
        this.setupInputElement( inputElement );
        this.setupRepositionListeners();
        this.addInitialTokens();
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
        
        element.addEventListener( 'input', function() {
            
            this.onInput();
            
        }.bind( this ) );
        
        element.addEventListener( 'keydown', function( e ) {
            
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
            
            if ( !handled ) {
                if ( this.selectedTokenIndex !== undefined ) {
                    this.deselectToken();
                    delete this.selectedTokenIndex;
                }
            }
            
        }.bind( this ) );
        
        if ( this.options.documentClickHidesCompletions ) {
        
            document.documentElement.addEventListener( 'click', function() {
                
                if ( this.completions.length ) {
                    this.removeCompletions();
                }
                
            }.bind( this ) );
            
        }
        
        if ( this.options.containerClickTriggersFocus ) {
        
            element.parentNode.addEventListener( 'click', function() {
                
                this.inputElement.focus();
                
            }.bind( this ) );
            
        }
        
        if ( this.options.hintElement ) {
            
            this.inputElement.addEventListener( 'focus', function() {
                
                if ( !this.willShowHintElement ) {
                    this.willShowHintElement = true;
                    return;
                }
                
                this.showHintElement();                
                
            }.bind( this ) );
            
        }
        
    };

    T.prototype.onInput = function() {
        
        this.suggestCompletions();
        
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
        else if ( this.inputElement.value.length ) {
            this.inputElement.value = '';
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
        else if ( this.options.freeTextEnabled !== false && this.inputElement.value.length ) {
            e.preventDefault();
            this.addTokenFromInputElement();
        }
        
    };

    T.prototype.onLeft = function( e ) {
        
        if ( 
            this.tokens.length &&
            this.inputElement.selectionStart === 0 &&
            this.inputElement.selectionEnd === 0 &&
            this.inputElement.value.length === 0
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

        if ( 
            this.selectedTokenIndex !== undefined &&
            this.inputElement.value.length === 0
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
            this.inputElement.value.length === 0
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
        
    };

    T.prototype.onZ = function( e ) {
        
        if ( !( e.metaKey || e.ctrlKey ) ) {
            return;
        }
        
        if ( this.inputElement.value.length ) {
            return;
        }
        
        e.preventDefault();
        
        if ( !e.shiftKey ) {
            this.undo();
        }
        
    };

    T.prototype.undo = function() {
        
        var undoFunction = this.undoStack.pop();
        if ( undoFunction ) {
            undoFunction();
        }
        
    };
    
    T.prototype.removeFloatingElement = function() {
        
        if ( this.floatingElement ) {
            this.floatingElement.parentNode.removeChild( this.floatingElement );
            delete this.floatingElement;
        }
        
    };

    T.prototype.setupFloatingElement = function() {
        
        this.removeFloatingElement();
        
        var element = document.createElement( 'div' );
        element.className = 'floating';
        
        var removeElement = this._createRemoveElement();
        removeElement.addEventListener( 'click', this.onRemoveFloatingElementClick.bind( this ) );
        element.appendChild( removeElement );
        
        var listElement = this.completionsListElement = document.createElement( 'div' );
        listElement.className = 'list';
        element.appendChild( listElement );
        
        this.inputElement.parentNode.appendChild( element );
        
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
        
        var text = this.inputElement.value,
            completions = options.completions ? options.completions.slice( 0 ) : 
                this.options.completionsForText( text, ++this.nextDelayedCompletionsId, 
                    function( delayedCompletionsId, delayedCompletions ) {
                    
                        if ( delayedCompletionsId != this.nextDelayedCompletionsId ) {
                            return;
                        }
                        this.suggestCompletions( {
                            completions : delayedCompletions,
                            preserveSelection : true
                        } );
                    
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
            return;
        }
        
        this.setupFloatingElement();
        
        var previousGroup;
        
        completions.forEach( function( datum ) {
            
            var containerElement = this.completionsListElement,
                datumGroup = datum.displayGroup || datum.group;
            
            if ( datumGroup ) {
                var group = this.options.completionGroups[ datumGroup ];
                if ( group && group != previousGroup ) {
                    
                    group.id = datumGroup;
                    
                    var groupContainer = document.createElement( 'div' );
                    groupContainer.className = 
                        [ 'group' ].concat( this.options.completionGroupClassNames( group ) ).join( ' ' );
                        
                    if ( group.heading ) {
                        var heading = document.createElement( 'div' );
                        heading.className = 
                            [ 'heading' ].concat( this.options.completionGroupHeadingClassNames( group ) ).join( ' ' );
                        heading.innerText = group.heading;
                        groupContainer.appendChild( heading );
                    }
                    
                    this.completionsListElement.appendChild( groupContainer );
                    containerElement = groupContainer;
                    
                    previousGroup = group;
                    
                    delete group.id;
                    
                }
            }
            
            var element = document.createElement( 'a' );
            element.style.display = 'block';
            element.className = 
                [ 'completion' ].concat( this.options.completionClassNames( datum ) ).join( ' ' );
            element.innerText = datum.text;
            element.addEventListener( 'click', this.onCompletionClick.bind( this ) );
            containerElement.appendChild( element );
            
            this.completionElements.push( element );
            
        }, this );
        
        this.positionFloatingElement();
        
    };

    T.prototype.onCompletionClick = function( e ) {
        
        var index = this.completionElements.indexOf( e.target );
        if ( index != -1 ) {
            
            this.selectedCompletionIndex = index;
            this.addTokenFromSelectedCompletion();
            
            this.inputElement.focus();
            
        }
        
        e.preventDefault();
        return false;
        
    };

    T.prototype.positionFloatingElement = function() {
        
        if ( !this.floatingElement ) {
            return;
        }
        
        if ( this.options.positionFloatingElement ) {
            this.options.positionFloatingElement( this.floatingElement );
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
        this.floatingElement.style.top = inputTop + this.inputElement.offsetHeight + 'px';
        
        var rect = this.floatingElement.getBoundingClientRect();
        if ( rect.bottom > document.documentElement.clientHeight ) {
            
            this.floatingElement.style.left = inputLeft + 'px';
            this.floatingElement.style.top = inputTop - ( rect.height ) + 'px';
            this.completionsAboveInput = true;
            
        }
        else {
            
            this.completionsAboveInput = false;
            
        }
        
    };

    T.prototype.deselectCompletion = function() {
        
        var element = this.completionElements[ this.selectedCompletionIndex ];
        element.classList.remove( 'selected' );
        
    };

    T.prototype.selectCompletion = function() {
        
        var element = this.completionElements[ this.selectedCompletionIndex ];
        element.classList.add( 'selected' );
        
    };

    T.prototype.removeCompletions = function() {
        
        this.completions = [];
        this.completionElements = [];
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
        
        this.afterUsersAddsToken();
        
    };
    
    T.prototype.addTokenFromInputElement = function() {
        
        this.addToken( this.options.freeTextToken( this.inputElement.value ) );
        
        this.afterUsersAddsToken();
        
    };

    T.prototype.afterUsersAddsToken = function() {
        
        this.inputElement.value = '';
        
        if ( this.completions.length ) {
            this.removeCompletions();
        }
        
        if ( this.options.hintElement && this.options.hintAfterAdd ) {
            this.showHintElement();
        }
        
    };

    T.prototype.addToken = function( datum, options ) {
        
        options = options || {};
        
        var element = document.createElement( 'div' );
        element.style.display = 'inline-block';
        element.className = 
            [ 'token' ].concat( this.options.tokenClassNames( datum ) ).join( ' ' );
        
        element.innerText = datum.text;
        element.addEventListener( 'click', this.onTokenClick.bind( this ) );
        
        var removeElement = this._createRemoveElement();
        removeElement.addEventListener( 'click', this.onRemoveTokenClick.bind( this ) );
        element.appendChild( removeElement );
        
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
        
        this.tokenElements.push( element );
        
        this.tokens.push( datum );
        
        if ( !options.silent ) {
            this.dispatchEvent( 'change' );
            this.dispatchEvent( 'add', datum );
        }
        
        if ( !options.isUndoing && options.canUndo !== false ) {
            var tokenIndex = this.tokens.length - 1;
            this.toUndo( function() {
                
                if ( tokenIndex < this.tokens.length ) {
                    this.selectedTokenIndex = tokenIndex;
                    this.removeSelectedToken( {
                        isUndoing : true
                    } );
                }
                delete this.selectedTokenIndex;
                
            }.bind( this ) );
        }
        
    };

    T.prototype.onTokenClick = function( e ) {
        
        var tokenElements = this.tokenElements,
            index = tokenElements.indexOf( e.target );
        if ( index != -1 ) {
            
            if ( this.completions.length ) {
                this.removeCompletions();
            }

            if ( this.selectedTokenIndex !== undefined ) {
                this.deselectToken();
            }
            this.selectedTokenIndex = index;
            this.selectToken();
            
            this.inputElement.value = '';
            this.inputElement.focus();
            
            this.dispatchEvent( 'tokenClicked', e.target );
            
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
            
            this.inputElement.focus();
            
        }
        
        e.preventDefault();
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
            
        tokenElement.parentNode.removeChild( tokenElement );
        
        var removedToken = this.tokens.splice( selectedTokenIndex, 1 )[ 0 ];
        
        this.dispatchEvent( 'change' );
        this.dispatchEvent( 'remove', removedToken );
        
        if ( !options.isUndoing ) {
            this.toUndo( function() {
                this.addToken( removedToken, {
                    index : selectedTokenIndex,
                    isUndoing : true
                } );
            }.bind( this ) );
        }
        
    };

    T.prototype.deselectToken = function() {
        
        var element = this.tokenElements[ this.selectedTokenIndex ];
        element.classList.remove( 'selected' );

    };

    T.prototype.getValue = function() {
        
        return this.getValues().join( ',' );
        
    };

    T.prototype.getValues = function() {
        
        var values = [];
        this.tokens.forEach( function( token ) {
            values.push( token.value );
        } );
        return values;
        
    };


    T.prototype.getData = function() {
        
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

    T.prototype.toUndo = function( undoFunction ) {
        
        if ( !this.options.undo ) {
            return;
        }
        this.undoStack.push( undoFunction );
        if ( this.options.undoLimit > 0 ) {
            this.undoStack = this.undoStack.slice( -this.options.undoLimit );
        }
        
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
        
        window.addEventListener( 'resize', this.positionFloatingElementAfterDelay.bind( this ) );
        window.addEventListener( 'scroll', this.positionFloatingElementAfterDelay.bind( this ) );
        
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

    T.prototype.addInitialTokens = function() {
        
        if ( this.options.data ) {
            this.options.data.forEach( function( datum ) {
                this.addToken( datum, {
                    silent : true,
                    canUndo : false
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
    
    //
    
    function TokenInput() {
    }
    
    global.TokenInput = function( element, options ) {
        
        var instance = new T( element, options ),
            exposed = new TokenInput();
            
        [
            'getValue',
            'getValues',
            'getData'
        ].forEach( function( method ) {
            
            exposed[ method ] = instance[ method ].bind( instance );
            
        } );
        return exposed;
        
    };
    
} )( window );