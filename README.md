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
