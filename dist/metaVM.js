"use strict";

require("core-js/modules/es6.object.define-property");

require("core-js/modules/es6.promise");

require("regenerator-runtime/runtime");

require("core-js/modules/es6.function.name");

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var StateManager = require('./stateManager.js');

var Common = require('ethereumjs-common').default;

var Account = require('ethereumjs-account');

var Trie = require('merkle-patricia-tree/secure.js');

var fakeBlockchain = require('./fakeBlockChain.js');

var Buffer = require('safe-buffer').Buffer;

var utils = require('ethereumjs-util');

var Block = require('ethereumjs-block');

var lookupOpInfo = require('./vm/opcodes.js');

var opFns = require('./vm/opFns.js');

var exceptions = require('./exceptions.js');

var StorageReader = require('./storageReader');

var BN = utils.BN;
var ERROR = exceptions.ERROR;
var VmError = exceptions.VmError; // find all the valid jumps and puts them in the `validJumps` array

function preprocessValidJumps(runState) {
  for (var i = 0; i < runState.code.length; i++) {
    var curOpCode = lookupOpInfo(runState.code[i]).name; // no destinations into the middle of PUSH

    if (curOpCode === 'PUSH') {
      i += runState.code[i] - 0x5f;
    }

    if (curOpCode === 'JUMPDEST') {
      runState.validJumps.push(i);
    }
  }
}
/**
 * An extensible base class for using the EVM.
 * @class MetaVM
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


var MetaVM =
/*#__PURE__*/
function () {
  function MetaVM() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, MetaVM);

    var chain = opts.chain ? opts.chain : 'mainnet';
    var hardfork = opts.hardfork ? opts.hardfork : 'byzantium';
    var supportedHardforks = ['byzantium', 'constantinople', 'petersburg'];
    this._common = new Common(chain, hardfork, supportedHardforks);

    if (opts.stateManager) {
      this.stateManager = opts.stateManager;
    } else {
      var trie = opts.state || new Trie();

      if (opts.activatePrecompiles) {
        for (var i = 1; i <= 8; i++) {
          trie.put(new BN(i).toArrayLike(Buffer, 'be', 20), new Account().serialize());
        }
      }

      this.stateManager = new StateManager({
        trie: trie,
        common: this._common
      });
    }

    this.blockchain = opts.blockchain || fakeBlockchain;
    this.allowUnlimitedContractSize = opts.allowUnlimitedContractSize === undefined ? false : opts.allowUnlimitedContractSize;
    this.emitFreeLogs = opts.emitFreeLogs === undefined ? false : opts.emitFreeLogs; // precompiled contracts

    this._precompiled = this.constructor.PRECOMPILED;
  }
  /**
   * Checks if the execution given `runState` is not yet completed.
   * @method canContinueExecution
   * @memberof MetaVM
   * @param {Object} runState
   * @returns {boolean} Returns {@code true} if the execution is not yet completed.
   */


  _createClass(MetaVM, [{
    key: "canContinueExecution",
    value: function canContinueExecution(runState) {
      var notAtEnd = runState.programCounter < runState.code.length;
      var canContinue = !runState.stopped && notAtEnd && !runState.vmError && !runState.returnValue;
      return canContinue;
    }
    /**
     * Common function to create the VM (internal) `runState` object.
     * @method initRunState
     * @memberof MetaVM
     * @param {Object} opts
     * @param {Account} opts.account the [`Account`](https://github.com/ethereumjs/ethereumjs-account) that the executing code belongs to. If omitted an empty account will be used
     * @param {Buffer} opts.address the address of the account that is executing this code. The address should be a `Buffer` of bytes. Defaults to `0`
     * @param {Block} opts.block the [`Block`](https://github.com/ethereumjs/ethereumjs-block) the `tx` belongs to. If omitted a blank block will be used
     * @param {Buffer} opts.caller the address that ran this code. The address should be a `Buffer` of 20bits. Defaults to `0`
     * @param {Buffer} opts.code the EVM code to run given as a `Buffer`
     * @param {Buffer} opts.data the input data
     * @param {Buffer} opts.gasLimit the gas limit for the code
     * @param {Buffer} opts.origin the address where the call originated from. The address should be a `Buffer` of 20bits. Defaults to `0`
     * @param {Buffer} opts.value the value in ether that is being sent to `opt.address`. Defaults to `0`
     * @param {Number} opts.pc the initial program counter. Defaults to `0`
     * @returns {Object} Returns the initial `runState` object.
     */

  }, {
    key: "initRunState",
    value: function () {
      var _initRunState = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee() {
        var opts,
            runState,
            stateManager,
            account,
            _args = arguments;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                opts = _args.length > 0 && _args[0] !== undefined ? _args[0] : {};
                // VM internal state
                runState = {
                  blockchain: this.blockchain,
                  stateManager: this.stateManager,
                  storageReader: opts.storageReader || new StorageReader(this.stateManager),
                  returnValue: false,
                  stopped: false,
                  vmError: false,
                  programCounter: opts.pc | 0,
                  opCode: undefined,
                  opName: undefined,
                  stackIn: 0,
                  stackOut: 0,
                  gasLeft: new BN(opts.gasLimit),
                  gasLimit: new BN(opts.gasLimit),
                  gasPrice: opts.gasPrice,
                  memory: [],
                  memoryWordCount: new BN(0),
                  stack: [],
                  lastReturned: [],
                  logs: [],
                  validJumps: [],
                  gasRefund: new BN(0),
                  highestMemCost: new BN(0),
                  depth: opts.depth || 0,
                  // opts.suicides is kept for backward compatiblity with pre-EIP6 syntax
                  selfdestruct: opts.selfdestruct || opts.suicides || {},
                  block: opts.block || new Block(),
                  callValue: opts.value || new BN(0),
                  address: opts.address || utils.zeros(32),
                  caller: opts.caller || utils.zeros(32),
                  origin: opts.origin || opts.caller || utils.zeros(32),
                  callData: opts.data || Buffer.from([0]),
                  code: opts.code || Buffer.alloc(0),
                  static: opts.static || false // temporary - to be factored out

                };
                runState._common = this._common;
                runState._precompiled = this._precompiled;
                runState._vm = this; // preprocess valid jump locations

                preprocessValidJumps(runState); // ensure contract is loaded

                if (runState.contract) {
                  _context.next = 12;
                  break;
                }

                stateManager = runState.stateManager;
                _context.next = 10;
                return new Promise(function (resolve, reject) {
                  stateManager.getAccount(runState.address, function (err, account) {
                    if (err) {
                      reject(err);
                      return;
                    }

                    resolve(account);
                  });
                });

              case 10:
                account = _context.sent;
                runState.contract = account;

              case 12:
                return _context.abrupt("return", runState);

              case 13:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function initRunState() {
        return _initRunState.apply(this, arguments);
      }

      return initRunState;
    }()
    /**
     * Run the next execution step given `runState.programCounter`.
     * @method runNextStep
     * @memberof MetaVM
     * @param {Object} The runState object.
     */

  }, {
    key: "runNextStep",
    value: function () {
      var _runNextStep = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(runState) {
        var opCode, opInfo, opName, prevStatic;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                opCode = runState.code[runState.programCounter];
                opInfo = lookupOpInfo(opCode, false, this.emitFreeLogs);
                opName = opInfo.name;
                runState.opName = opName;
                runState.opCode = opCode;
                runState.stackIn = opInfo.in;
                runState.stackOut = opInfo.out; // check for invalid opcode

                if (!(opName === 'INVALID')) {
                  _context2.next = 9;
                  break;
                }

                throw new VmError(ERROR.INVALID_OPCODE);

              case 9:
                if (!(runState.stack.length < opInfo.in)) {
                  _context2.next = 11;
                  break;
                }

                throw new VmError(ERROR.STACK_UNDERFLOW);

              case 11:
                if (!(runState.stack.length - opInfo.in + opInfo.out > 1024)) {
                  _context2.next = 13;
                  break;
                }

                throw new VmError(ERROR.STACK_OVERFLOW);

              case 13:
                // calculate gas
                runState.gasLeft = runState.gasLeft.subn(opInfo.fee);

                if (!runState.gasLeft.ltn(0)) {
                  _context2.next = 17;
                  break;
                }

                runState.gasLeft = new BN(0);
                throw new VmError(ERROR.OUT_OF_GAS);

              case 17:
                // advance program counter
                runState.programCounter++; // if opcode is log and emitFreeLogs is enabled, remove static context

                prevStatic = runState.static;

                if (this.emitFreeLogs && opName === 'LOG') {
                  runState.static = false;
                } // run the opcode handler


                _context2.next = 22;
                return this['handle' + opName](runState);

              case 22:
                // restore previous static context
                runState.static = prevStatic;

              case 23:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function runNextStep(_x) {
        return _runNextStep.apply(this, arguments);
      }

      return runNextStep;
    }()
    /**
     * Runs the next `stepCount` steps given the `runState` object. If `stepCount` is `0`, the function runs until the vm execution ends.
     * @method run
     * @memberof MetaVM
     * @param {Object} runState
     * @param {Number} stepCount (Optional) The initial program counter. Defaults to `0`.
     */

  }, {
    key: "run",
    value: function () {
      var _run = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3(runState, stepCount) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                stepCount = stepCount | 0;

              case 1:
                if (!this.canContinueExecution(runState)) {
                  _context3.next = 9;
                  break;
                }

                _context3.next = 4;
                return this.runNextStep(runState);

              case 4:
                if (!(stepCount !== 0)) {
                  _context3.next = 7;
                  break;
                }

                if (!(--stepCount === 0)) {
                  _context3.next = 7;
                  break;
                }

                return _context3.abrupt("break", 9);

              case 7:
                _context3.next = 1;
                break;

              case 9:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function run(_x2, _x3) {
        return _run.apply(this, arguments);
      }

      return run;
    }()
  }]);

  return MetaVM;
}();

MetaVM.PRECOMPILED = {
  '0000000000000000000000000000000000000001': require('./precompiled/01-ecrecover.js'),
  '0000000000000000000000000000000000000002': require('./precompiled/02-sha256.js'),
  '0000000000000000000000000000000000000003': require('./precompiled/03-ripemd160.js'),
  '0000000000000000000000000000000000000004': require('./precompiled/04-identity.js'),
  '0000000000000000000000000000000000000005': require('./precompiled/05-modexp.js'),
  '0000000000000000000000000000000000000006': require('./precompiled/06-ecadd.js'),
  '0000000000000000000000000000000000000007': require('./precompiled/07-ecmul.js'),
  '0000000000000000000000000000000000000008': require('./precompiled/08-ecpairing.js') // generate the prototypes for `handle<OPCODE>`

};

var _loop = function _loop(i) {
  var opInfo = lookupOpInfo(i);
  var opFn = opFns[opInfo.name];
  var handlerName = 'handle' + opInfo.name;

  if (MetaVM.prototype[handlerName]) {
    return "continue";
  }
  /**
   * Function(s) that handles the opcode, like `handleADD(runState)`. It serves the purpose to add custom logic.
   * @method handleOPCODE
   * @memberof MetaVM
   * @param {Object} runState
   */


  MetaVM.prototype[handlerName] =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee4(state) {
      var argsNum, retNum, args, handleResult;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              handleResult = function _ref2(result) {
                // save result to the stack
                if (result !== undefined) {
                  if (retNum !== 1) {
                    // opcode post-stack mismatch
                    throw new VmError(ERROR.INTERNAL_ERROR);
                  }

                  state.stack.push(result);
                } else {
                  if (retNum !== 0) {
                    // opcode post-stack mismatch
                    throw new VmError(ERROR.INTERNAL_ERROR);
                  }
                }
              };

              argsNum = state.stackIn;
              retNum = state.stackOut; // pop the stack

              args = argsNum ? state.stack.splice(-argsNum) : [];
              args.reverse();
              args.push(state);
              return _context4.abrupt("return", new Promise(function (resolve, reject) {
                if (opInfo.async) {
                  args.push(function (err, result) {
                    if (err) {
                      reject(err);
                      return;
                    }

                    handleResult(result);
                    resolve();
                  });
                  opFn.apply(null, args);
                  return;
                }

                handleResult(opFn.apply(null, args));
                resolve();
              }));

            case 7:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, this);
    }));

    return function (_x4) {
      return _ref.apply(this, arguments);
    };
  }();
};

for (var i = 0; i <= 0xff; i++) {
  var _ret = _loop(i);

  if (_ret === "continue") continue;
}

module.exports = MetaVM;