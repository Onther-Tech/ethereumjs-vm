"use strict";

require("core-js/modules/es7.symbol.async-iterator");

require("core-js/modules/es6.symbol");

require("core-js/modules/es6.object.create");

require("core-js/modules/es6.object.set-prototype-of");

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var AsyncEventEmitter = require('async-eventemitter');

var MetaVM = require('./metaVM.js');
/**
 * VM Class, `new VM(opts)` creates a new VM object
 * @class VM
 * @implements MetaVM
 * @constructor
 * @param {Object} opts
 * @param {StateManager} opts.stateManager a [`StateManager`](stateManager.md) instance to use as the state store (Beta API)
 * @param {Trie} opts.state a merkle-patricia-tree instance for the state tree (ignored if stateManager is passed)
 * @param {Blockchain} opts.blockchain a blockchain object for storing/retrieving blocks (ignored if stateManager is passed)
 * @param {String|Number} opts.chain the chain the VM operates on [default: 'mainnet']
 * @param {String} opts.hardfork hardfork rules to be used [default: 'byzantium', supported: 'byzantium', 'constantinople', 'petersburg' (will throw on unsupported)]
 * @param {Boolean} opts.activatePrecompiles create entries in the state tree for the precompiled contracts
 * @param {Boolean} opts.allowUnlimitedContractSize allows unlimited contract sizes while debugging. By setting this to `true`, the check for contract size limit of 24KB (see [EIP-170](https://git.io/vxZkK)) is bypassed. (default: `false`; ONLY set to `true` during debugging)
 * @param {Boolean} opts.emitFreeLogs Changes the behavior of the LOG opcode, the gas cost of the opcode becomes zero and calling it using STATICCALL won't throw. (default: `false`; ONLY set to `true` during debugging)
 */


var VM =
/*#__PURE__*/
function (_MetaVM) {
  _inherits(VM, _MetaVM);

  function VM() {
    var _this;

    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, VM);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(VM).call(this, opts));
    AsyncEventEmitter.call(_assertThisInitialized(_this));
    return _this;
  }

  return VM;
}(MetaVM);

VM.prototype.runCode = require('./runCode.js');
VM.prototype.runJIT = require('./runJit.js');
VM.prototype.runBlock = require('./runBlock.js');
VM.prototype.runTx = require('./runTx.js');
VM.prototype.runCall = require('./runCall.js');
VM.prototype.runBlockchain = require('./runBlockchain.js');

VM.prototype.copy = function () {
  return new VM({
    stateManager: this.stateManager.copy(),
    blockchain: this.blockchain
  });
}; // util.inherits(VM, AsyncEventEmitter) - destroys the prototype; do it manually


for (var k in AsyncEventEmitter.prototype) {
  VM.prototype[k] = AsyncEventEmitter.prototype[k];
}

VM.deps = {
  ethUtil: require('ethereumjs-util'),
  Account: require('ethereumjs-account'),
  Trie: require('merkle-patricia-tree'),
  rlp: require('ethereumjs-util').rlp
};
VM.MetaVM = MetaVM;
module.exports = VM;