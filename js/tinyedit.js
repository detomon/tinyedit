(function (d, w) {

'use strict';

var classNamespace = 'tinyedit';
var classPrefix = classNamespace + '-';
var elementKey = classNamespace + ((Math.random() * 10000000) | 0);

function className(name) {
	return classPrefix + name;
}

/**
 * Get DOM index of element.
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
	var body = d.body;

	return {
		x: body.scrollLeft + docElement.scrollLeft,
		y: body.scrollTop + docElement.scrollTop,
	};
}

/**
 * Convert from relative viewport coordinates to absolute coordinates.
 */
function positionFromRelativePosition(x, y) {
	var scrollOffset = windowScrollOffset();

	return {
		x: x - scrollOffset.x,
		y: y - scrollOffset.y,
	};
}

/**
 * Convert from absolute coordinates to relative viewport coordinates.
 */
function positionToRelativePosition(x, y) {
	var scrollOffset = windowScrollOffset();

	return {
		x: x + scrollOffset.x,
		y: y + scrollOffset.y,
	};
}

/**
 *
 */
function selectionRange() {
	var selection = w.getSelection();

	return selection.rangeCount ? selection.getRangeAt(0) : null;
}

/**
 * Get offset and textNode from viewport coordinates.
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
 * Remove element from DOM.
 */
function removeElement(element) {
	var parentNode;

	if (element && (parentNode = element.parentNode)) {
		parentNode.removeChild(element);
	}
}

/**
 * Remove element and merge adjacent text nodes.
 */
function removeElementAndMerge(element) {
	var parentNode;

	if (element && (parentNode = element.parentNode)) {
		removeElement(element);
		parentNode.normalize();
	}
}

/**
 *
 */
function parentNodeFromClickTarget(element) {
	var parentNode;

	while (parentNode = element.parentNode) {
		if (hasClass(parentNode, 'container')) {
			return element;
		}

		element = parentNode;
	}

	return null;
}

/**
 *
 */
function hasClass(element, name) {
	return element && element.classList && element.classList.contains(className(name));
}

/**
 *
 */
function hasNodeName(element, nodeName) {
	return element && element.nodeName.toLowerCase() === nodeName;
}

/**
 *
 */
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

/**
 *
 */
function createElement(elementName, classNames, attributes) {
	var element = d.createElement(elementName);

	if (classNames) {
		classNames = classNames.map(function (name) {
			return className(name);
		});

		element.classList.add.apply(element.classList, classNames);
	}

	if (attributes) {
		for (var key in attributes) {
			element.setAttribute(key, attributes[key]);
		}
	}

	return element;
}

/**
 *
 */
function createLineElement(text) {
	var line = createElement('div');
	var inner = createElement('div');

	inner.innerHTML = text;
	line.appendChild(inner);

	return line;
}

/**
 *
 */
function createLineElementFromRawLineContent(text) {
	// replace tabs with tab element
	text = text.replace(/(\t)/g, '<span class="' + className('tab') + '">$1</span>');

	return createLineElement(text);
}

/**
 *
 */
function extend(obj, obj2) {
	var args = Array.prototype.slice.call(arguments, 1);

	for (var i = 0; i < args.length; i ++) {
		var arg = args[i];

		for (var j in arg) {
			if (arg.hasOwnProperty(j)) {
				if (arg[j] !== null && arg[j] !== undefined) {
					obj[j] = arg[j];
				}
			}
		}
	}

	return obj;
}

/**
 *
 */
function TinyEdit(editor, options) {
	var self = this;

	options = extend({
		tabWidth: 4,
		tabStyle: 'hard', // hard, soft
		textarea: null,
		firstLineNumber: 1,
		lineBreak: '\n',
		editable: true,
	}, options);

	this.options = options;
	editor.style.tabSize = options.tabWidth;
	editor.style.MozTabSize = options.tabWidth;

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

					while (!hasNodeName(parent, 'div')) {
						parent = parent.parentNode;
					}

					parent.normalize();
				}
			});

			this.list = [];
		},
		create: function () {
			var cursor = createElement('span', ['cursor', 'blink']);
			this.list.push(cursor);

			return cursor;
		},
		inputBlur: function () {
			self.cursors.removeAll();
		},
		createInputElement: function () {
			if (!this.inputElement) {
				var input = createElement('textarea', ['input'], {
					wrap: 'off',
					autocapitalize: 'off',
					spellcheck: 'false',
				});

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
				var number = createElement('div');
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

	var contentElement = createElement('div', ['content']);
	var gutterElement = createElement('div', ['gutter']);
	var contentInner = createElement('div', ['content-inner', 'container']);
	var gutterInner = createElement('div', ['gutter-inner', 'container']);
	var data;

	contentElement.appendChild(contentInner);
	gutterElement.appendChild(gutterInner);

	if (options.textarea) {
		data = options.textarea.value;
		textarea.style.display = 'none';
	}
	else {
		data = editor.textContent;
	}

	data = data.split(/\r?\n/m);

	data.forEach(function (text) {
		var line = createLineElementFromRawLineContent(text);
		contentInner.appendChild(line);
	});

	this.lines.element = contentInner;
	this.gutter.element = gutterInner;
	this.gutter.update();

	editor.innerHTML = '';
	editor.appendChild(gutterElement);
	editor.appendChild(contentElement);

	if (options.editable) {
		editor.addEventListener('mousedown', function (e) {
			self.handleMouseDownEvent(e);
		});
	}

	/*editor.addEventListener('transitionend', function (e) {
						console.log(e);

		if (e.propertyName == 'height') {
			var target = e.target;

			if (target.parentNode.classList.contains('tinyedit-content-inner')) {
			}
		}
	});*/
}

var proto = TinyEdit.prototype;

/**
 *
 */
proto.handleGutterClick = function(numberElement, e) {

};

/**
 *
 */
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
	if (hasClass(fragment.parentNode, 'tab')) {
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
	else if (hasClass(fragment, 'cursor')) {
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

	if (hasNodeName(textNode, 'div')) {
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

/**
 *
 */
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
	if (hasClass(parentNode, 'content-inner')) {
		target = target.querySelector('div');
		self.handleTextClick(target, e);
	}
	// gutter
	else if (hasClass(parentNode, 'gutter-inner')) {
		self.handleGutterClick(target, e);
	}
};

/**
 *
 */
window.TinyEdit = function (element, options) {
	if (!element || !element.parentNode || !element.ownerDocument) {
		return null;
	}

	if (!element[elementKey]) {
		var editor = new TinyEdit(element, options)
		element[elementKey] = editor;
	}

	return element[elementKey];
};

}(document, window));
