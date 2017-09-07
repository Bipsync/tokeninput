### Introducing tokeninput
Dependency-free Javascript UI component providing a token based input element with grouped completion lists and free-text entry

### Usage
Create an instance of the TokenInput class with two parameters:
- an instance of an Input DOM element
- a configuration object, to tailor the component to your needs

```html
<script src="tokeninput/tokeninput.js" />
<div id="tokeninput">
  <input placeholder="Type something…" />
</div>
```
```javascript
new TokenInput( document.getElementById( 'tokeninput' ), {} );
```

See [index.html](index.html) and [demo.js](demo.js) for examples.

There are lots of options, see [tokeninput.js](tokeninput.js)

### API

`addEventListener(element, type, listener)`

Adds an event listener to the given element.

`getTokens()`

Returns an array of objects representing each token added to the component.

`setCompletionGroups(completionGroups)`

Configures the completion groups that visually separate suggestions.

`removeFloatingElement()`

Hides the suggestion UI.

`removeToken(datum, options)`

Removes the given token from the component UI and the component's internal list of tokens.

`setTokens(newTokens)`

Removes all existing tokens from the UI and replaces them with the tokens in the given array.

`destroy()`
Cleans up by removing all registered event listeners.


### Options

Name | Description | Default
-----|------------|--------
readOnly | Prevents tokens from being added / removed | `false`
tabToAdd | Pressing the tab key submits the current token and allows a new one to be entered | `true`
xHTML | A string which represents the delete button in a token | `&times;`
tokenClassNames | A function which is called for each added token. Should return an array of class names that will be added to the token HTML element. | `[]`
tokenFormatter | A function which is called for each added token. Can be used to customise the token element for display when not in inline mode | |
inlineTokenFormatter | A function which is called for each added token. Can be used to customise the token element for display when in inline mode | |
containerClickTriggersFocus | Determines if a click on the containing element will focus the tokeninput | true
freeTextEnabled | Determines whether the user is able to enter arbitrary tokens (`true`) or forced to select a pre-existing datum (`false`) | `false`
freeTextToken | A function that determines the makeup of a datum created via free-text | 
freeTextCompletion | A function that determines the makeup of an object that represents free-text entry which is passwd to the suggestion handler | 
willShowFreeTextCompletion | A function that determines whether or not to show the completion view for free-text | 
inlineTokenTrigger | An object which defines logic for determining whether to show completion for typed text when in inline mode | 
