window.addEventListener( 'load', function() {

    var defaultSuggestions = [
            { text: 'Aardvark', value : 1, type : 'red' },
            { text: 'Apple', value : 2, type : 'blue' },
            { text: 'Banana', value : 3, type : 'green' },
            { text: 'Cage', value : 4, type : 'red' },
            { text: 'Cab', value : 5, type : 'blue' },
            { text: 'Car', value : 6, type : 'green' },
            { text: 'Caravan', value : 7, type : 'red' },
            { text: 'Caviar', value : 8, type : 'blue' }
        ],

        groupedSuggestions = [
            { text : 'Apple', group : 'fruits' },
            { text : 'Orange', group : 'fruits' },
            { text : 'Strawberry', group : 'fruits' },
            { text : 'Car', group : 'vehicles' },
            { text : 'Bus', group : 'vehicles' },
            { text : 'Aeroplane', group : 'vehicles' },
            { text : 'Azure', group : 'colours' },
            { text : 'Aqua', group : 'colours' },
            { text : 'Green', group : 'colours' }
        ],

        freeTextSuggestions = [
            { text: 'Aardvark', value : 1, type : 'red', classes : 'token', link: 'http://www.aardvark.com' },
            { text: 'Apple', value : 2, type : 'blue', classes : 'token', link: 'http://www.apple.com' },
            { text: 'Apple & Banana', value : 2, type : 'blue', classes : 'token', link: 'http://www.apple.com' },
            { text: 'Banana', value : 3, type : 'green', link: 'http://www.banana.com' },
            { text: 'Cage', value : 4, type : 'red', link: 'http://www.banana.com' },
            { text: 'Cab', value : 5, type : 'blue', link: 'http://www.cab.com' },
            { text: 'Car', value : 6, type : 'green', link: 'http://www.car.com' },
            { text: 'Caravan', value : 7, type : 'red', link: 'http://www.caravan.com' },
            { text: 'Caviar', value : 8, type : 'blue', link: 'http://www.caviar.com' },
            { text: 'Multiple Words', value : 2, type : 'blue', classes : 'token', link: 'http://www.apple.com' }
        ],

        completionsForTextWithSuggestions = function( suggestions ) {
            return function( text ) {
                var completions = [];
                text = text.toLowerCase();
                if ( text.length ) {
                    suggestions.forEach( function( suggestion ) {
                        var suggestionText = suggestion.text.toLowerCase();
                        if ( suggestionText.substr( 0, text.length ) == text ) {
                            completions.push( suggestion );
                        }
                    }, this );
                }
                return completions;
            };
        };

    [
        {
            id : 'demo1',
            completionsForText : completionsForTextWithSuggestions( defaultSuggestions )
        }, {
            id : 'demo2'
        }, {
            id : 'demo3',
            freeTextEnabled : false,
            completionsForText : completionsForTextWithSuggestions( defaultSuggestions )
        }, {
            id : 'demo4',
            completionsForText : completionsForTextWithSuggestions( defaultSuggestions ),
            data : [
                { text: 'Existing', value : 2 },
                { text: 'Tokens', value : 3 }
            ]
        }, {
            id : 'demo5',
            completionsForText : completionsForTextWithSuggestions( defaultSuggestions ),
            data : [
                { text: 'Existing', value : 2, type : 'red' },
                { text: 'Tokens', value : 3, type : 'green' },
                { text: 'With classes', value : 4, type : 'blue' }
            ],
            tokenClassNames : function( datum ) {
                return [ datum.type ];
            },
            completionClassNames : function( datum ) {
                return [ datum.type ];
            }
        }, {
            id : 'demo6',
            freeTextEnabled : true,
            completionsForText : completionsForTextWithSuggestions( defaultSuggestions )
        }, {
            id : 'demo7',
            completionGroups : {
                fruits : { heading : 'Fruits' },
                vehicles : { heading : 'Vehicles' },
                colours : { heading : 'Colours' }
            },
            completionsForText : completionsForTextWithSuggestions( groupedSuggestions )
        }, {
            id : 'demo8',
            completionGroups : {
                fruits : { heading : 'Fruits', newOption : true, singular : 'Fruit' },
                vehicles : { heading : 'Vehicles' },
                colours : { heading : 'Colours', newOption : true }
            },
            completionsForText : completionsForTextWithSuggestions( groupedSuggestions )
        }, {
            id : 'demo10',
            completionsForText : completionsForTextWithSuggestions( groupedSuggestions ),
            completionGroups : {
                fruits : { heading : 'Fruits', newOption : true, singular : 'Fruit' },
                vehicles : { heading : 'Vehicles' },
                colours : { heading : 'Colours', newOption : true }
            },
            hintElement : document.getElementById( 'demo10hints' )
        }, {
            id : 'demo11',
            completionsForText : completionsForTextWithSuggestions( groupedSuggestions ),
            completionGroups : {
                fruits : { heading : 'Fruits', newOption : true, singular : 'Fruit' },
                vehicles : { heading : 'Vehicles' },
                colours : { heading : 'Colours', newOption : true }
            },
            hintElement : document.getElementById( 'demo11hints' ),
            hintAfterAdd : true,
        }, {
            id : 'demo12',
            completionsForText : function( text, delayedId, delayedFn ) {

                var completions = completionsForTextWithSuggestions( groupedSuggestions )( text );
                if ( text.length ) {
                    setTimeout( function() {
                        delayedFn( delayedId, completions.concat( [ {
                            text : 'Delayed Colour',
                            group : 'colours'
                        }, {
                            text : 'Pink',
                            group : 'colours'
                        } ] ) );
                    }, 1000 );
                }
                return completions;

            },
            completionGroups : {
                fruits : { heading : 'Fruits', newOption : true, singular : 'Fruit' },
                vehicles : { heading : 'Vehicles' },
                colours : { heading : 'Colours', newOption : true }
            }
        }, {
            id : 'demo13',
            completionsForText : function( text ) {

                var completions = completionsForTextWithSuggestions( groupedSuggestions )( text );
                if ( completions.length ) {
                    var bestMatch = {};
                    for ( var key in completions[ 0 ] ) {
                        bestMatch[ key ] = completions[ 0 ][ key ];
                    }
                    bestMatch.displayGroup = 'bestmatch';
                    bestMatch.select = true;
                    completions = [ bestMatch ].concat( completions );
                }
                return completions;

            },
            completionGroups : {
                bestmatch : { heading : 'Best Match' },
                fruits : { heading : 'Fruits', newOption : true, singular : 'Fruit' },
                vehicles : { heading : 'Vehicles' },
                colours : { heading : 'Colours', newOption : true }
            }
        }, {
            id : 'demo14',
            completionsForText : completionsForTextWithSuggestions( defaultSuggestions ),
            tokenFormatter : function( datum, element ) {
                element.innerText += ' FORMATTED';
            },
            completionFormatter : function( datum, element ) {
                element.innerText += ' FORMATTED';
            }
        }, {
            id : 'demo15',
            data : [
                { text: 'Red' },
                { text: 'Green' },
                { text: 'Blue' },
                { text: 'Purple' },
                { text: 'Orange' },
                { text: 'Navy' }
            ]
        }, {
            id : 'demo16',
            completionsForText : completionsForTextWithSuggestions( freeTextSuggestions ),
            selector : '[contenteditable]',
            inlineTokenFormatter : function( datum ) {
                return '<span contenteditable="false" class="token">' + datum.text + '</span>';
            }
        }, {
            id : 'demo17',
            completionsForText : completionsForTextWithSuggestions( defaultSuggestions ),
            namespace : 'tokeninput-'
        }
    ].forEach( function( options ) {

        var id = options.id,
            container = document.getElementById( id ),
            inputElement = container.querySelector( options.selector || 'input' );

        delete options.id;
        delete options.selector;

        var tokenInput = new TokenInput( inputElement, options );

        window.tokenInputs = window.tokenInputs || [];
        window.tokenInputs.push( tokenInput );

        inputElement.addEventListener( 'change', function() {
            window.setTimeout( function() {
                console.log( id + ' = ' + JSON.stringify( tokenInput.getTokens() ) );
            }, 0 );
        } );

        inputElement.addEventListener( 'add', function( e ) {
            window.setTimeout( function() {
                console.log( id + ' added ' + JSON.stringify( e.detail ) );
            }, 0 );
        } );

        inputElement.addEventListener( 'tokenClicked', function( e ) {
            console.log( 'clicked', e.detail );
        } );

    } );

} );
