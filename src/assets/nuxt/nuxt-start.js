/*
 * nuxt-start.js
 * Copyright (C) 2020 kevin olson <acidjazz@gmail.com>
 *
 * Distributed under terms of the APACHE license.
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const core = require('@nuxt/core');

Object.keys(core).forEach(function (k) {
	if (k !== 'default') Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () {
			return core[k];
		}
	});
});
