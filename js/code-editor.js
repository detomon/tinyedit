(function (d, w) {

'use strict';

var classNamespace = 'code-editor';
var classPrefix = classNamespace + '-';
var elementKey = classNamespace + ((Math.random() * 10000000) | 0);

function className(name) {
	return classPrefix + name;
}

/**
 * Get DOM index of element
 */
function indexOfElement(element) {
	if (!element.parentNode) {
		return -1;
	}

	// `children` does not include textNodes, whereas `childNodes` does
	return Array.prototype.indexOf.call(element.parentNode.children, element);
}

function windowScrollOffset() {
	var docElement = d.documentElement;

	return {
		x: d.body.scrollLeft + docElement.scrollLeft,
		y: d.body.scrollTop + docElement.scrollTop,
	};
}

/**
 * Convert from relative viewport coordinates to absolute coordinates
 */
function positionFromRelativePosition(x, y) {
	var scrollOffset = windowScrollOffset();

	x -= scrollOffset.x;
	y -= scrollOffset.y;

	return {
		x: x,
		y: y,
	};
}

/**
 * Convert from absolute coordinates to relative viewport coordinates
 */
function positionToRelativePosition(x, y) {
	var scrollOffset = windowScrollOffset();

	x += scrollOffset.x;
	y += scrollOffset.y;

	return {
		x: x,
		y: y,
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
		offset: offset,
	};
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
 * Remove element and merge adjacent text nodes
 */
function removeElementAndMerge(element) {
	if (element && element.parentNode) {
		var parentNode = element.parentNode;

		removeElement(element);
		parentNode.normalize();
	}
}

function parentNodeFromClickTarget(element) {
	while (element.parentNode) {
		if (element.parentNode.classList.contains(className('container'))) {
			return element;
		}

		element = element.parentNode;
	}

	return null;
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

function createLineElement(text) {
	var line = d.createElement('div');
	var inner = d.createElement('div');

	inner.innerHTML = text;
	line.appendChild(inner);

	return line;
}

function extend(obj, obj2) {
	var i, j;
	var arg;
	var args = Array.prototype.slice.call(arguments, 1);

	for (i = 0; i < args.length; i ++) {
		var arg = args[i];

		for (j in arg) {
			if (arg.hasOwnProperty(j)) {
				if (arg[j] !== null && arg[j] !== undefined) {
					obj[j] = arg[j];
				}
			}
		}
	}

	return obj;
}

function stringRepeat(string, count) {
	var newString = '';

	for (var i = 0; i < count; i ++) {
		newString += string;
	}

	return newString;
}

function CodeEditor(editor, options) {
	var self = this;

	options = extend({
		tabWidth: 4,
		tabStyle: 'hard',
		textarea: null,
		firstLineNumber: 1,
		lineBreak: '\n',
	}, options);

	options.tabContent = stringRepeat(' ', options.tabWidth);

	this.options = options;

	this.deferred = {
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
				}, 0);
			}
		}
	};

	this.cursors = {
		list: [],
		remove: function (cursor) {
			var n = this.list.indexOf(cursor);

			if (n >= 0) {
				this.list.splice(n, 1);
			}
		},
		removeAll: function () {
			if (this.inputElement) {
				this.inputElement.removeEventListener('blur', this.inputBlur);
			}

			this.list.forEach(function (cursor) {
				var parent = cursor.parentNode;

				if (parent) {
					parent.removeChild(cursor);

					while (parent.nodeName.toLowerCase() != 'div') {
						parent = parent.parentNode;
					}

					parent.normalize();
				}
			});

			this.list = [];
		},
		create: function () {
			var cursor = d.createElement('span');
			cursor.classList.add(className('cursor'), className('blink'));
			this.list.push(cursor);

			return cursor;
		},
		inputBlur: function () {
			self.cursors.removeAll();
		},
		createInputElement: function () {
			if (!this.inputElement) {
				var input = d.createElement('textarea');

				input.setAttribute('wrap', 'off');
				input.setAttribute('autocapitalize', 'off');
				input.setAttribute('spellcheck', 'false');
				input.classList.add(className('input'));

				this.inputElement = input;
			}

			return this.inputElement;
		},
		activateForInput: function (cursor) {
			var input = this.createInputElement();

			cursor.appendChild(input);
			input.focus();

			input.addEventListener('blur', this.inputBlur);
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

	this.lines = {
		element: null
	};

	this.gutter = {
		element: null,
		update: function () {
			var element = this.element;
			var i = element.childNodes.length;
			var n = self.lines.element.childNodes.length;

			while (i < n) {
				var number = d.createElement('div');
				number.textContent = options.firstLineNumber + i;
				element.appendChild(number);
				i ++;
			}

			while (i > n) {
				element.removeChild(element.lastChild);
				i --;
			}
		}
	};

	this.value = function (options) {
		var self = this;

		options = extend({
			tabWidth: self.options.tabWidth,
			tabStyle: self.options.tabStyle,
			lineBreak: self.options.lineBreak,
		}, options);

		var data = [];
		var lines = this.lines.element.children;

		for (var i = 0; i < lines.length; i ++) {
			data.push(lines[i].textContent);
		}

		return data.join(options.lineBreak);
	};

	var contentElement = d.createElement('div');
	var gutterElement = d.createElement('div');
	var contentInner = d.createElement('div');
	var gutterInner = d.createElement('div');
	var data;

	contentElement.appendChild(contentInner);
	gutterElement.appendChild(gutterInner);

	contentElement.classList.add(className('content'));
	contentInner.classList.add(className('content-inner'), className('container'));
	gutterElement.classList.add(className('gutter'));
	gutterInner.classList.add(className('gutter-inner'), className('container'));

	if (options.textarea) {
		data = options.textarea.value;
		textarea.style.display = 'none';
	}
	else {
		data = editor.textContent;
	}

	data = data.split(/\r?\n/m);

	data.forEach(function (text) {
		var line = self.createLineElementFromRawLineContent(text);
		contentInner.appendChild(line);
	});

	this.lines.element = contentInner;
	this.gutter.element = gutterInner;
	this.gutter.update();

	editor.innerHTML = '';
	editor.appendChild(gutterElement);
	editor.appendChild(contentElement);

	editor.addEventListener('mousedown', function (e) {
		self.handleMouseDownEvent(e);
	});

}

var proto = CodeEditor.prototype;

proto.createLineElementFromRawLineContent = function(text) {
	// remove trailing space
	text = text.replace(/\s+$/g, '');
	// replace tabs with tab element
	text = text.replace(/\t/g, '<span class="' + className('tab') + '">' + this.options.tabContent + '</span>');

	return createLineElement(text);
};

proto.handleGutterClick = function(numberElement, e) {

};

proto.handleTextClick = function(lineElement, e) {
	this.cursors.removeAll();

	var self = this;
	var x = e.pageX;
	var y = e.pageY;
	var offset = textOffsetFromPosition(lineElement, x, y);

	if (!offset) {
		return;
	}

	var fragment = offset.textNode;

	// tab
	if (fragment.parentNode.classList.contains(className('tab'))) {
		var tab = fragment.parentNode;
		var rect = tab.getBoundingClientRect();

		self.cursors.removeAll();

		var cursor = self.cursors.create();
		var before;

		if (x >= rect.left + rect.width * 0.5) {
			before = tab.nextSibling;
		}
		else {
			before = tab;
		}

		tab.parentNode.insertBefore(cursor, before);
		self.cursors.activateForInput(cursor);

		return;
	}
	// cursor
	else if (fragment.classList && fragment.classList.contains(className('cursor'))) {
		if (fragment.nextSibling) {
			fragment = fragment.nextSibling;
		}
		else {
			fragment = fragment.parentNode.insertBefore(d.createTextNode(''), fragment);
		}

		offset.textNode = fragment;
	}

	var cursor = self.cursors.create();
	var textNode = offset.textNode;

	if (textNode.nodeName.toLowerCase() == 'div') {
		textNode.appendChild(cursor);
	}
	else if (offset.offset == 0) {
		textNode.parentNode.insertBefore(cursor, textNode);
	}
	else if (offset.offset == offset.textNode.nodeValue.length) {
		textNode.parentNode.insertBefore(cursor, textNode.nextSibling);
	}
	else {
		var next = offset.textNode.splitText(offset.offset);
		next.parentNode.insertBefore(cursor, next);
	}

	self.cursors.activateForInput(cursor);
};

proto.handleMouseDownEvent = function(e) {
	var self = this;
	var target = e.target;

	e.preventDefault();
	target = parentNodeFromClickTarget(target);

	if (!target) {
		return null;
	}

	var parentNode = target.parentNode;

	// lines
	if (parentNode.classList.contains(className('content-inner'))) {
		target = target.querySelector('div');
		self.handleTextClick(target, e);
	}
	// gutter
	else if (parentNode.classList.contains(className('gutter-inner'))) {
		self.handleGutterClick(target, e);
	}
};

window.CodeEditor = function (element, options) {
	if (!element || !element.parentNode || !element.ownerDocument) {
		return null;
	}

	if (!element[elementKey]) {
		var editor = new CodeEditor(element, options)
		element[elementKey] = editor;
	}

	return element[elementKey];
};

}(document, window));
