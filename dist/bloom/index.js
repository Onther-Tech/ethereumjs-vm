"use strict";

require("core-js/modules/es6.object.define-property");

require("core-js/modules/es6.array.is-array");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var assert = require('assert');

var utils = require('ethereumjs-util');

var BYTE_SIZE = 256;

module.exports =
/*#__PURE__*/
function () {
  /**
   * Represents a Bloom
   * @constructor
   * @param {Buffer} bitvector
   */
  function Bloom(bitvector) {
    _classCallCheck(this, Bloom);

    if (!bitvector) {
      this.bitvector = utils.zeros(BYTE_SIZE);
    } else {
      assert(bitvector.length === BYTE_SIZE, 'bitvectors must be 2048 bits long');
      this.bitvector = bitvector;
    }
  }
  /**
   * adds an element to a bit vector of a 64 byte bloom filter
   * @method add
   * @param {Buffer|Array|String|Number} e the element to add
   */


  _createClass(Bloom, [{
    key: "add",
    value: function add(e) {
      e = utils.keccak256(e);
      var mask = 2047; // binary 11111111111

      for (var i = 0; i < 3; i++) {
        var first2bytes = e.readUInt16BE(i * 2);
        var loc = mask & first2bytes;
        var byteLoc = loc >> 3;
        var bitLoc = 1 << loc % 8;
        this.bitvector[BYTE_SIZE - byteLoc - 1] |= bitLoc;
      }
    }
    /**
     * checks if an element is in the bloom
     * @method check
     * @param {Buffer|Array|String|Number} e the element to check
     * @returns {boolean} Returns {@code true} if the element is in the bloom
     */

  }, {
    key: "check",
    value: function check(e) {
      e = utils.keccak256(e);
      var mask = 2047; // binary 11111111111

      var match = true;

      for (var i = 0; i < 3 && match; i++) {
        var first2bytes = e.readUInt16BE(i * 2);
        var loc = mask & first2bytes;
        var byteLoc = loc >> 3;
        var bitLoc = 1 << loc % 8;
        match = this.bitvector[BYTE_SIZE - byteLoc - 1] & bitLoc;
      }

      return Boolean(match);
    }
    /**
     * checks if multiple topics are in a bloom
     * @method multiCheck
     * @param {Buffer[]|Array[]|String[]|Number[]} topics
     * @returns {boolean} Returns {@code true} if every topic is in the bloom
     */

  }, {
    key: "multiCheck",
    value: function multiCheck(topics) {
      var _this = this;

      return topics.every(function (t) {
        return _this.check(t);
      });
    }
    /**
     * bitwise or blooms together
     * @method or
     * @param {Bloom} bloom
     */

  }, {
    key: "or",
    value: function or(bloom) {
      if (bloom) {
        for (var i = 0; i <= BYTE_SIZE; i++) {
          this.bitvector[i] = this.bitvector[i] | bloom.bitvector[i];
        }
      }
    }
  }]);

  return Bloom;
}();