(function (d, w) {

'use strict';

var de = d.documentElement;
var globalClassName = 'code-editor';
var classPrefix = globalClassName + '-';

var deferred = {
	funcs: [],
	timeout: null,
	run: function (func) {
		var self = this;
		this.funcs.push(func);

		if (!this.timeout) {
			this.timeout = w.setTimeout(function () {
				for (var i = 0; i < self.funcs.length; i ++) {
					self.funcs[i]();
				}

				self.funcs = [];
				self.timeout = null;
			}, 10);
		}
	}
};

var cursors = {
	list: [],
	remove: function (cursor) {
		var n = indexOfObject(this.list, cursor);

		if (n >= 0) {
			this.list.splice(n, 1);
		}
	},
	create: function () {
		var cursor = d.createElement('span');
		cursor.classList.add(className('cursor'), className('blink'));
		this.list.push(cursor);

		return cursor;
	},
	resetBlink: function () {
		var self = this;

		this.list.forEach(function (cursor) {
			cursor.classList.remove(className('blink'));
		});

		deferred.run(function () {
			self.list.forEach(function (cursor) {
				cursor.classList.add(className('blink'));
			});
		});
	}
};

var lines = {
	element: null
};

var gutter = {
	element: null,
	update: function () {
		var element = this.element;
		var i = element.childNodes.length;
		var n = lines.element.childNodes.length;

		while (i < n) {
			var number = d.createElement('div');
			number.textContent = i + 1;
			element.appendChild(number);
			i ++;
		}

		while (i > n) {
			element.removeChild(element.lastChild);
			i --;
		}
	}
};

function className(name) {
	return classPrefix + name;
}

/**
 * Convert from relative viewport coordinates to absolute coordinates
 */
function positionFromRelativePosition(x, y) {
	x -= d.body.scrollLeft + de.scrollLeft;
	y -= d.body.scrollTop + de.scrollTop;

	return {
		x: x,
		y: y
	};
}

/**
 * Convert from absolute coordinates to relative viewport coordinates
 */
function positionToRelativePosition(x, y) {
	x += d.body.scrollLeft + de.scrollLeft;
	y += d.body.scrollTop + de.scrollTop;

	return {
		x: x,
		y: y
	};
}

/**
 * Get offset and textNode from viewport coordinates
 */
function textOffsetFromPosition(lineElement, x, y) {
	var range;
	var textNode;
	var offset;

	var position = positionFromRelativePosition(x, y);
	x = position.x;
	y = position.y;

	if (d.caretPositionFromPoint) {
		range = d.caretPositionFromPoint(x, y);
		textNode = range.offsetNode;
		offset = range.offset;
	}
	else if (d.caretRangeFromPoint) {
		range = d.caretRangeFromPoint(x, y);
		textNode = range.startContainer;
		offset = range.startOffset;
	}
	else {
		return calcTextOffsetFromPosition(lineElement, x, y);
	}

	return {
		textNode: textNode,
		offset: offset
	};
}

/**
 * Returns the fragment and relative offset containing the character offset
 *
 * If `fragment` is null, the offset is not contained in the element
 */
function fragmentContainingOffset(lineElement, offset) {
	var fragment = lineElement.firstChild;

	while (fragment) {
		if (fragment.textContent) {
			if (offset < fragment.textContent.length) {
				break;
			}

			offset -= fragment.textContent.length;
		}

		fragment = fragment.nextSibling;
	}

	return {
		fragment: fragment,
		offset: offset
	};
}

/**
 * Insert element at specific offset in line element
 */
function insertElementAtOffset(element, lineElement, offset) {
	var text;
	var textNode;
	var info = fragmentContainingOffset(lineElement, offset);
	var fragment = info.fragment;

	if (fragment) {
		text = fragment.textContent;
		fragment.textContent = text.slice(0, info.offset);
		textNode = d.createTextNode(text.slice(info.offset));
		fragment.parentNode.insertBefore(textNode, fragment.nextSibling);
		fragment.parentNode.insertBefore(element, textNode);
	}
	else {
		lineElement.appendChild(element);
	}
}

/**
 * Alternative for calculating offset and textNode from viewport coordinates
 */
function calcTextOffsetFromPosition(lineElement, x, y) {
	var caret = d.createElement('span');
	caret.style.width= '1px';
	caret.style.height = '1em';
	caret.style.display = 'inline-block';

	var length = lineLength(lineElement);
	var range = [0, length + 1];
	var offset = 0;
	var center = 0;

	var rect;
	var textNode;

	while (range[0] < range[1]) {
		var center = ((range[0] + range[1]) / 2) | 0;

		// remove caret and merge adjacent text nodes
		if (caret.previousSibling && caret.nextSibling) {
			if (caret.previousSibling.textContent && caret.nextSibling.textContent) {
				caret.previousSibling.textContent += caret.nextSibling.textContent;
				removeElement(caret.nextSibling);
				removeElement(caret);
			}
		}

		insertElementAtOffset(caret, lineElement, center);
		rect = caret.getBoundingClientRect();

		// left from center
		if (rect.left < x) {
			range[0] = center + 1;
		}
		// right from center
		else {
			range[1] = center;
		}
	}

	if (caret.previousSibling && caret.nextSibling) {
		if (caret.previousSibling.textContent && caret.nextSibling.textContent) {
			caret.previousSibling.textContent += caret.nextSibling.textContent;
			removeElement(caret.nextSibling);
		}
	}

	textNode = prevTextSibling(caret);
	removeElement(caret);

	return {
		textNode: textNode,
		offset: range[0]
	};
}

/**
 * Get character count of line element
 */
function lineLength(lineElement) {
	return lineElement.textContent.length;
}

/**
 * Get absolute character offset for text fragment and relative offset
 */
function absoluteCharacterOffsetInLine(textNode, lineElement, offset) {
	var absOffset = offset;

	textNode = textNode.previousSibling;

	while (textNode) {
		absOffset += textNode.textContent.length;

		if (!textNode.previousSibling && textNode.parentNode != lineElement) {
			textNode = textNode.parentNode;
		}
		else {
			textNode = textNode.previousSibling;
		}
	}

	return absOffset;
}

/**
 * Delete single character in text fragment
 */
function deleteCharacter(textNode, direction) {
	var cursorSpan = textNode;
	textNode = direction > 0 ? textNode.nextSibling : textNode.previousSibling;

	if (textNode) {
		var text = textNode.textContent;
		var range = direction > 0 ? [1] : [0, text.length - 1];
		text = text.substring.apply(text, range);

		if (text.length) {
			textNode.textContent = text;
		}
		else {
			removeElement(textNode);
		}

		cursors.resetBlink();
	}
}

/**
 * Get next text sibling or create if not exists
 */
function nextTextSibling(element) {
	var textNode = element.nextSibling;

	if (!textNode) {
		textNode = d.createTextNode('');
		element.parentNode.insertBefore(textNode, element.nextSibling);
	}

	return textNode;
}

/**
 * Get previous text sibling or create if not exists
 */
function prevTextSibling(element) {
	var textNode = element.previousSibling;

	if (!textNode) {
		textNode = d.createTextNode('');
		element.parentNode.insertBefore(textNode, element);
	}

	return textNode;
}

/**
 * Insert character before cursor element
 */
function insertCharacter(cursorSpan, text) {
	prevTextSibling(cursorSpan).textContent += text;
	cursors.resetBlink();
}

/**
 * Insert tab before cursor element
 */
function insertTab(cursorSpan) {
	var tab = d.createElement('span');
	tab.textContent = '    ';
	tab.classList.add(className('tab'));

	cursorSpan.parentNode.insertBefore(tab, cursorSpan);
}

/**
 * Move cursor element by single character
 */
function moveCursorHorizontal(cursorSpan, direction) {
	if (direction > 0) {
		var next = cursorSpan.nextSibling;

		if (next) {
			var text = next.textContent.slice(0, 1);
			next.textContent = next.textContent.slice(1);
			prevTextSibling(cursorSpan).textContent += text;
		}
		else {
			// next line
		}
	}
	else {
		var next = nextTextSibling(cursorSpan);
		var prev = cursorSpan.previousSibling;

		if (prev) {
			var text = prev.textContent.slice(-1);

			prev.textContent = prev.textContent.slice(0, -1);
			next.textContent = text + next.textContent;
		}
		else {
			// prev line
		}
	}

	cursors.resetBlink();
}

/**
 * Remove element
 */
function removeElement(element) {
	if (element && element.parentNode) {
		element.parentNode.removeChild(element);
	}
}

/**
 * Remove element and merge adjacent text elements
 *
 * Do not merge tabs
 */
function removeElementAndMerge(element) {
	if (element && element.parentNode) {
		var prev = element.previousSibling;
		var next = element.nextSibling;

		if (prev && next &&
			(!prev.classList || !prev.classList.contains(className('tab'))) &&
			(!next.classList || !next.classList.contains(className('tab'))))
		{
			prev.textContent += next.textContent;
			removeElement(next);
		}

		removeElement(element);
	}
}

function indexOfObject(list, obj) {
	var i, n = -1;

	for (i = 0; i < list.length; i ++) {
		if (list[i] == obj) {
			n = i;
			break;
		}
	}

	return n;
}

function getNearestEndOfTab(tabSpan, x) {
	var rect = tabSpan.getBoundingClientRect();

	return x - (rect.left + rect.width / 2);
}

function keyDown(keyCode) {
	switch (keyCode) {
		case 8: { // delete
			break;
		}
		case 9: { // tab
			break;
		}
		case 13: { // enter
			break;
		}
		case 27: { // escape
			// abort current operation
			break;
		}
		case 37: { // left
			break;
		}
		case 38: { // up
			break;
		}
		case 39: { // right
			break;
		}
		case 40: { // down
			break;
		}
		case 46: { // backspace
			break;
		}
	}
}

function isTabElement(element) {
	return element.classList.contains(className('tab'));
}

function createInputElement() {
	var input = d.createElement('textarea');

	input.setAttribute('wrap', 'off');
	input.setAttribute('autocapitalize', 'off');
	input.setAttribute('spellcheck', 'false');
	input.classList.add(className('input'));

	input.addEventListener('blur', function () {
		var cursor = this.parentNode;

		if (cursor) {
			removeElementAndMerge(cursor);
			cursors.remove(cursor);
		}
	});

	return input;
}

function inputKeydown(e) {
	var input = this;
	var cursorSpan = this.parentNode;
	var value = input.value;
	var keyCode = e.keyCode;

	if (value == '~' || value == '¨' || value == '`') {
		// composite
	}

	if (keyCode == 8) { // delete
		e.preventDefault();
		input.value = '';
		deleteCharacter(cursorSpan, -1);
	}
	else if (keyCode == 46) { // backspace
		e.preventDefault();
		input.value = '';
		deleteCharacter(cursorSpan, 1);
	}
	else if (keyCode == 9) { // tab
		insertTab(cursorSpan);
		e.preventDefault();
		input.value = '';
		cursors.resetBlink();
	}
	else if (keyCode == 13) { // enter
		e.preventDefault();
		input.value = '';
	}
	else if (keyCode == 37) { // left
		moveCursorHorizontal(cursorSpan, -1);
	}
	else if (keyCode == 38) { // up
	}
	else if (keyCode == 39) { // right
		moveCursorHorizontal(cursorSpan, 1);
	}
	else if (keyCode == 40) { // down
	}
	/*else {
		deferred.run(function () {
			if (input.value != value) { // something has been written
				insertCharacter(cursorSpan, input.value);
				input.value = '';
			}
		});
	}*/
}

function addCursorFromEvent(content, gutter, e) {
	var x = e.pageX;
	var y = e.pageY;
	var line = e.target;

	e.preventDefault();

	if (isTabElement(line)) {
		var end = getNearestEndOfTab(line, x);
		var cursor = cursors.create();

		if (end >= 0) { // right
			line.parentNode.insertBefore(cursor, line.nextSibling);
		}
		else { // left
			line.parentNode.insertBefore(cursor, line);
		}

		cursors.resetBlink();

		return;
	}

	while (line.parentNode && line.parentNode != content) {
		line = line.parentNode;
	}

	if (line.parentNode == content) {
		var inner = line.querySelector('div');

		var offset = textOffsetFromPosition(inner, x, y);
		offset.offset = absoluteCharacterOffsetInLine(offset.textNode, inner, offset.offset);

		if (offset.textNode) {
			var input;
			var text = inner.textContent;
			var cursorSpan = cursors.create();

			insertElementAtOffset(cursorSpan, inner, offset.offset);

			input = createInputElement();

			cursorSpan.appendChild(input);

			input.addEventListener('keydown', function (e) {
				inputKeydown.call(input, e);
			});

			input.addEventListener('keypress', function (e) {
				inputKeydown.call(input, e);
			});
			input.addEventListener('input', function () {
				insertCharacter(cursorSpan, input.value);
				input.value = '';
			});

			input.focus();

			line.classList.add('highlighted');
		}
	}
	else if (line.parentNode == gutter) {
		//
	}
}

var editors = document.querySelectorAll('.' + globalClassName);

for (var i = 0; i < editors.length; i ++) {
	var editor = editors.item(i);
	var contentElement = d.createElement('div');
	var gutterElement = d.createElement('div');
	var contentInner = d.createElement('div');
	var gutterInner = d.createElement('div');
	var data;

	contentElement.appendChild(contentInner);
	gutterElement.appendChild(gutterInner);
	lines.element = contentInner;

	data = editor.textContent;
	editor.innerHTML = '';

	contentElement.classList.add(className('content'));
	contentInner.classList.add(className('content-inner'));
	gutterElement.classList.add(className('gutter'));
	gutterInner.classList.add(className('gutter-inner'));

	data = data.split(/\r?\n/m);

	for (var i = 0; i < data.length; i ++) {
		var text = data[i];
		var line = d.createElement('div');
		var inner = d.createElement('div');

		text = text.replace(/\t/g, '<span class="' + classPrefix + 'tab">    </span>');
		line.appendChild(inner);
		inner.innerHTML = text;

		contentInner.appendChild(line);
	}

	gutter.element = gutterInner;
	gutter.update();

	editor.appendChild(gutterElement);
	editor.appendChild(contentElement);

	editor.addEventListener('mousedown', function (e) {
		addCursorFromEvent(contentInner, gutterElement, e);
	});
}

d.addEventListener('keydown', function (e) {
	keyDown(e.keyCode, e);
});

d.addEventListener('keypress', function (e) {
	keyDown(e.keyCode, e);
});

}(document, window));
