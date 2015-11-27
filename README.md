### Introducing tokeninput
Dependency-free Javascript UI component providing a token based input element with grouped completion lists and free-text entry

### Usage
See [index.html](index.html) and [demo.js](demo.js) but basically:
```html
<script src="tokeninput/tokeninput.js" />
<div id="tokeninput">
  <input placeholder="Type something…" />
</div>
```
```javascript
new TokenInput( document.getElementById( 'tokeninput' ), {} );
```
There are lots of options, see [tokeninput.js](tokeninput.js)
