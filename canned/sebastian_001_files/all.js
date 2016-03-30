(function() {
  var Analyser, AudioBufferSource, BiquadFilter, ChannelMerger, ChannelSplitter, Convolver, Delay, DynamicsCompressor, Gain, MediaElementSource, Mooog, MooogAudioNode, Oscillator, Panner, ScriptProcessor, StereoPanner, Track, WaveShaper,
    slice = [].slice,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  MooogAudioNode = (function() {
    function MooogAudioNode(_instance, config) {
      this._instance = _instance;
      this._destination = this._instance._destination;
      this.context = this._instance.context;
      this._nodes = [];
      this.config_defaults = {
        connect_to_destination: true
      };
      this.config = {};
      this._connections = [];
      this._exposed_properties = {};
      if (this.constructor.name === "MooogAudioNode") {
        if (Mooog.LEGAL_NODES[config.node_type] != null) {
          return new Mooog.LEGAL_NODES[config.node_type](this._instance, config);
        } else {
          throw new Error("Omitted or undefined node type in config options.");
        }
      } else {
        this.configure_from(config);
        this.before_config(config);
        this.zero_node_setup(config);
        this.after_config(config);
      }
    }

    MooogAudioNode.prototype.configure_from = function(ob) {
      var k, ref, v;
      this.node_type = ob.node_type != null ? ob.node_type : this.constructor.name;
      this.id = ob.id != null ? ob.id : this.new_id();
      ref = this.config_defaults;
      for (k in ref) {
        v = ref[k];
        this.config[k] = k in ob ? ob[k] : this.config_defaults[k];
      }
      return this.config;
    };

    MooogAudioNode.prototype.zero_node_settings = function(ob) {
      var k, v, zo;
      zo = {};
      for (k in ob) {
        v = ob[k];
        if (!(k in this.config_defaults || k === 'node_type' || k === 'id')) {
          zo[k] = v;
        }
      }
      return zo;
    };

    MooogAudioNode.prototype.zero_node_setup = function(config) {
      var k, ref, results, v;
      if (this._nodes[0] != null) {
        this.expose_properties_of(this._nodes[0]);
      }
      ref = this.zero_node_settings(config);
      results = [];
      for (k in ref) {
        v = ref[k];
        this.debug("zero node settings, " + k + " = " + v);
        results.push(this.param(k, v));
      }
      return results;
    };

    MooogAudioNode.prototype.toString = function() {
      return (this.node_type + "#") + this.id;
    };

    MooogAudioNode.prototype.new_id = function() {
      return this.node_type + "_" + (Math.round(Math.random() * 100000));
    };

    MooogAudioNode.prototype.__typeof = function(thing) {
      if (thing instanceof AudioParam) {
        return "AudioParam";
      }
      if (thing instanceof AudioNode) {
        return "AudioNode";
      }
      if (thing instanceof AudioBuffer) {
        return "AudioBuffer";
      }
      if (thing instanceof PeriodicWave) {
        return "PeriodicWave";
      }
      if (thing instanceof AudioListener) {
        return "AudioListener";
      }
      if (thing instanceof Track) {
        return "Track";
      }
      if (thing instanceof MooogAudioNode) {
        return "MooogAudioNode";
      }
      return typeof thing;
    };

    MooogAudioNode.prototype.insert_node = function(node, ord) {
      var length;
      length = this._nodes.length;
      if (ord == null) {
        ord = length;
      }
      if (node._destination != null) {
        node.disconnect(node._destination);
      }
      if (ord > length) {
        throw new Error("Invalid index given to insert_node: " + ord + " out of " + length);
      }
      this.debug("insert_node of " + this + " for", node, ord);
      if (ord === 0) {
        this.connect_incoming(node);
        this.disconnect_incoming(this._nodes[0]);
        if (length > 0) {
          node.connect(this.to(this._nodes[0]));
          this.debug('- node.connect to ', this._nodes[0]);
        }
      }
      if (ord === length) {
        if (ord !== 0) {
          this.safely_disconnect(this._nodes[ord - 1], this.from(this._destination));
        }
        if (ord !== 0) {
          this.debug("- disconnect ", this._nodes[ord - 1], 'from', this._destination);
        }
        if (this.config.connect_to_destination) {
          node.connect(this.to(this._destination));
          this.debug('- connect', node, 'to', this._destination);
        }
        if (ord !== 0) {
          this._nodes[ord - 1].connect(this.to(node));
        }
        if (ord !== 0) {
          this.debug('- connect', this._nodes[ord - 1], "to", node);
        }
      }
      if (ord !== length && ord !== 0) {
        this.safely_disconnect(this._nodes[ord - 1], this.from(this._nodes[ord]));
        this.debug("- disconnect", this._nodes[ord - 1], "from", this._nodes[ord]);
        this._nodes[ord - 1].connect(this.to(node));
        this.debug("- connect", this._nodes[ord - 1], "to", node);
        node.connect(this.to(this._nodes[ord]));
        this.debug("- connect", node, "to", this._nodes[ord]);
      }
      this._nodes.splice(ord, 0, node);
      return this.debug("- spliced:", this._nodes);
    };

    MooogAudioNode.prototype.delete_node = function(ord) {
      var del, length;
      if (ord == null) {
        return;
      }
      length = this._nodes.length;
      if (ord > (length - 1)) {
        throw new Error("Invalid index given to delete_node: " + ord + " out of " + length);
      }
      this.debug("delete of " + this + " for position", ord);
      if (ord !== 0) {
        this.safely_disconnect(this._nodes[ord - 1], this.from(this._nodes[ord]));
      }
      if (ord < (length - 1)) {
        this.safely_disconnect(this._nodes[ord], this.from(this._nodes[ord + 1]));
      }
      if (ord === (length - 1)) {
        this.safely_disconnect(this._nodes[ord], this.from(this._destination));
      }
      del = this._nodes.splice(ord, 1);
      delete del[0];
      return this.debug("remove node at index " + ord);
    };

    MooogAudioNode.prototype.add = function(nodes) {
      var i, j, len, results;
      if (!(nodes instanceof Array)) {
        nodes = [nodes];
      }
      results = [];
      for (j = 0, len = nodes.length; j < len; j++) {
        i = nodes[j];
        switch (this.__typeof(i)) {
          case "MooogAudioNode":
            results.push(this.insert_node(i));
            break;
          case "object":
            results.push(this.insert_node(this._instance.node(i)));
            break;
          default:
            throw new Error("Unknown argument type (should be config object or MooogAudioNode)");
        }
      }
      return results;
    };

    MooogAudioNode.prototype.connect_incoming = function() {};

    MooogAudioNode.prototype.disconnect_incoming = function() {};

    MooogAudioNode.prototype.connect = function(node, output, input, return_this) {
      var source, target;
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      if (return_this == null) {
        return_this = true;
      }
      this.debug("called connect from " + this + " to " + node + ", " + output);
      switch (this.__typeof(node)) {
        case "AudioParam":
          this._nodes[this._nodes.length - 1].connect(node, output);
          return this;
        case "string":
          node = this._instance.node(node);
          target = node._nodes[0];
          break;
        case "MooogAudioNode":
          target = node._nodes[0];
          break;
        case "AudioNode":
          target = node;
          break;
        default:
          throw new Error("Unknown node type passed to connect");
      }
      this._connections.push([node, output, input]);
      source = this instanceof Track ? this._gain_stage : this._nodes[this._nodes.length - 1];
      switch (false) {
        case typeof output !== 'string':
          source.connect(target[output], input);
          break;
        case typeof output !== 'number':
          source.connect(target, output, input);
      }
      if (return_this) {
        return this;
      } else {
        return node;
      }
    };

    MooogAudioNode.prototype.chain = function(node, output, input) {
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      if (this.__typeof(node) === "AudioParam" && typeof output !== 'string') {
        throw new Error("MooogAudioNode.chain() can only target AudioParams when used with the signature .chain(target_node:Node, target_param_name:string)");
      }
      this.disconnect(this._destination);
      return this.connect(node, output, input, false);
    };

    MooogAudioNode.prototype.to = function(node) {
      switch (this.__typeof(node)) {
        case "MooogAudioNode":
          return node._nodes[0];
        case "AudioNode":
          return node;
        default:
          throw new Error("Unknown node type passed to connect");
      }
    };

    MooogAudioNode.prototype.from = MooogAudioNode.prototype.to;

    MooogAudioNode.prototype.expose_properties_of = function(node) {
      var key, val;
      this.debug("exposing", node);
      for (key in node) {
        val = node[key];
        if ((this[key] != null) && !this._exposed_properties[key]) {
          continue;
        }
        this.expose_property(node, key);
      }
      return node;
    };

    MooogAudioNode.prototype.expose_property = function(node, key) {
      var val;
      this._exposed_properties[key] = true;
      val = node[key];
      switch (this.__typeof(val)) {
        case 'function':
          this[key] = val.bind(node);
          break;
        case 'AudioParam':
          this[key] = val;
          break;
        case "string":
        case "number":
        case "boolean":
        case "object":
          (function(o, node, key) {
            return Object.defineProperty(o, key, {
              get: function() {
                return node[key];
              },
              set: function(val) {
                return node[key] = val;
              },
              enumerable: true,
              configurable: true
            });
          })(this, node, key);
      }
      return key;
    };

    MooogAudioNode.prototype.safely_disconnect = function(node1, node2, output, input) {
      var e, source, target;
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      switch (this.__typeof(node1)) {
        case "MooogAudioNode":
          source = node1._nodes[node1._nodes.length - 1];
          break;
        case "AudioNode":
        case "AudioParam":
          source = node1;
          break;
        case "Track":
          source = node1._gain_stage;
          break;
        case "string":
          source = this._instance.node(node1);
          break;
        default:
          throw new Error("Unknown node type passed to disconnect");
      }
      switch (this.__typeof(node2)) {
        case "MooogAudioNode":
        case "Track":
          target = node2._nodes[0];
          break;
        case "AudioNode":
        case "AudioParam":
          target = node2;
          break;
        case "string":
          target = this._instance.node(node2);
          break;
        default:
          throw new Error("Unknown node type passed to disconnect");
      }
      try {
        source.disconnect(target, output, input);
      } catch (_error) {
        e = _error;
        this.debug("ignored InvalidAccessError disconnecting " + target + " from " + source);
      }
      return this;
    };

    MooogAudioNode.prototype.disconnect = function(node, output, input) {
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      return this.safely_disconnect(this, node, output, input);
    };

    MooogAudioNode.prototype.param = function(key, val) {
      var at, cancel, duration, extra, from_now, k, rampfun, ref, ref1, ref2, ref3, ref4, timeConstant, v;
      if (this.__typeof(key) === 'object') {
        at = parseFloat(key.at) || 0;
        timeConstant = key.timeConstant != null ? parseFloat(key.timeConstant) : false;
        duration = key.duration ? parseFloat(key.duration) : false;
        cancel = !!key.cancel;
        from_now = !!key.from_now;
        switch (key.ramp) {
          case "linear":
            ref = ["linearRampToValueAtTime", false], rampfun = ref[0], extra = ref[1];
            break;
          case "curve":
            ref1 = ["setValueCurveAtTime", duration], rampfun = ref1[0], extra = ref1[1];
            break;
          case "expo":
            if (timeConstant) {
              ref2 = ["setTargetAtTime", timeConstant], rampfun = ref2[0], extra = ref2[1];
            } else {
              ref3 = ["exponentialRampToValueAtTime", false], rampfun = ref3[0], extra = ref3[1];
            }
            break;
          default:
            ref4 = ["setValueAtTime", false], rampfun = ref4[0], extra = ref4[1];
        }
        for (k in key) {
          v = key[k];
          this.get_set(k, v, rampfun, at, cancel, from_now, extra);
        }
        return this;
      }
      return this.get_set(key, val, 'setValueAtTime', 0, true);
    };

    MooogAudioNode.prototype.get_set = function(key, val, rampfun, at, cancel, from_now, extra) {
      if (!((this[key] != null) || this.hasOwnProperty(key))) {
        return;
      }
      switch (this.__typeof(this[key])) {
        case "AudioParam":
          if (val != null) {
            if (cancel) {
              this[key].cancelScheduledValues(0);
            }
            if (cancel) {
              this.debug(key + ".cancelScheduledValues(0)");
            }
            if (val === 0 && (rampfun === "setTargetAtTime" || rampfun === "exponentialRampToValueAtTime")) {
              val = this._instance.config.fake_zero;
            }
            if (val instanceof Array) {
              val = new Float32Array(val);
            }
            switch (rampfun) {
              case "linearRampToValueAtTime":
              case "exponentialRampToValueAtTime":
                if (from_now) {
                  setTimeout(((function(_this) {
                    return function() {
                      _this[key].setValueAtTime(_this[key].value, _this.context.currentTime);
                      _this.debug(key + ".setValueAtTime(" + _this[key].value + ", " + _this.context.currentTime + ")");
                      _this[key][rampfun](val, _this.context.currentTime + at);
                      return _this.debug(key + "." + rampfun + "(" + val + ", " + (_this.context.currentTime + at) + ")");
                    };
                  })(this)), 1 / (this.context.sampleRate * 1000));
                } else {
                  this[key][rampfun](val, this.context.currentTime + at);
                }
                break;
              case "setValueAtTime":
                this[key][rampfun](val, this.context.currentTime + at);
                this.debug(key + "." + rampfun + "(" + val + ", " + (this.context.currentTime + at) + ")");
                break;
              case "setValueCurveAtTime":
                this[key][rampfun](val, this.context.currentTime + at, extra);
                this.debug(key + "." + rampfun + "(" + val + ", " + (this.context.currentTime + at) + ", " + extra + ")");
                break;
              case "setTargetAtTime":
                this[key][rampfun](val, this.context.currentTime + at, extra);
                this.debug(key + "." + rampfun + "(" + val + ", " + (this.context.currentTime + at) + ", " + extra + ")");
            }
            return this;
          } else {
            return this[key].value;
          }
          break;
        default:
          if (val != null) {
            this[key] = val;
            return this;
          } else {
            return this[key];
          }
      }
    };

    MooogAudioNode.prototype.define_buffer_source_properties = function() {
      this._buffer_source_file_url = '';
      return Object.defineProperty(this, 'buffer_source_file', {
        get: function() {
          return this._buffer_source_file_url;
        },
        set: (function(_this) {
          return function(filename) {
            var request;
            request = new XMLHttpRequest();
            request.open('GET', filename, true);
            request.responseType = 'arraybuffer';
            request.onload = function() {
              _this.debug("loaded " + filename);
              _this._buffer_source_file_url = filename;
              return _this._instance.context.decodeAudioData(request.response, function(buffer) {
                _this.debug("setting buffer", buffer);
                return _this.buffer = buffer;
              }, function(error) {
                throw new Error("Could not decode audio data from " + request.responseURL + " - unsupported file format?");
              });
            };
            return request.send();
          };
        })(this),
        enumerable: true,
        configurable: true
      });
    };

    MooogAudioNode.prototype.define_readonly_property = function(prop_name, func) {
      return Object.defineProperty(this, prop_name, {
        get: func,
        set: function() {
          throw new Error(this + "." + prop_name + " is read-only");
        },
        enumerable: true,
        configurable: false
      });
    };

    MooogAudioNode.prototype.adsr = function(param, config) {
      var _0, a, base, ramp, s, t, times;
      if (typeof param === "string") {
        param = this[param];
      }
      _0 = this._instance.config.fake_zero;
      base = config.base, times = config.times, a = config.a, s = config.s;
      if (base == null) {
        base = _0;
      }
      if (base === 0) {
        base = _0;
      }
      if (a == null) {
        a = 1;
      }
      if (a === 0) {
        a = _0;
      }
      if (s == null) {
        s = 1;
      }
      if (s === 0) {
        s = _0;
      }
      t = this.context.currentTime;
      times[0] || (times[0] = _0);
      times[1] || (times[1] = _0);
      if (times.length > 2) {
        times[2] || (times[2] = _0);
      }
      if (times.length > 3) {
        times[3] || (times[3] = _0);
      }
      if (config.ramp == null) {
        config.ramp = this._instance.config.default_ramp_type;
      }
      switch (config.ramp) {
        case 'linear':
          ramp = param.linearRampToValueAtTime.bind(param);
          break;
        case 'expo':
          ramp = param.exponentialRampToValueAtTime.bind(param);
      }
      if (times.length === 2) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(base, t);
        ramp(a, t + times[0]);
        return ramp(s, t + times[0] + times[1]);
      } else if (times.length === 3) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(base, t);
        ramp(a, t + times[0]);
        param.setValueAtTime(a, t + times[0] + times[1]);
        return ramp(base, t + times[0] + times[1] + times[2]);
      } else {
        param.cancelScheduledValues(t);
        param.setValueAtTime(base, t);
        ramp(a, t + times[0]);
        ramp(s, t + times[0] + times[1]);
        param.setValueAtTime(s, t + times[0] + times[1] + times[2]);
        return ramp(base, t + times[0] + times[1] + times[2] + times[3]);
      }
    };

    MooogAudioNode.prototype.debug = function() {
      var a;
      a = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      if (this._instance.config.debug) {
        return console.log.apply(console, a);
      }
    };

    return MooogAudioNode;

  })();

  Analyser = (function(superClass) {
    extend(Analyser, superClass);

    function Analyser(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      Analyser.__super__.constructor.apply(this, arguments);
    }

    Analyser.prototype.before_config = function(config) {
      return this.insert_node(this.context.createAnalyser(), 0);
    };

    Analyser.prototype.after_config = function(config) {};

    return Analyser;

  })(MooogAudioNode);

  AudioBufferSource = (function(superClass) {
    extend(AudioBufferSource, superClass);

    function AudioBufferSource(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      AudioBufferSource.__super__.constructor.apply(this, arguments);
    }

    AudioBufferSource.prototype.before_config = function(config) {
      this.insert_node(this.context.createBufferSource(), 0);
      return this.define_buffer_source_properties();
    };

    AudioBufferSource.prototype.after_config = function(config) {
      this.insert_node(new Gain(this._instance, {
        gain: 1.0,
        connect_to_destination: this.config.connect_to_destination
      }));
      this._state = 'stopped';
      return this.define_readonly_property('state', (function(_this) {
        return function() {
          return _this._state;
        };
      })(this));
    };

    AudioBufferSource.prototype.start = function() {
      if (this._state === 'playing') {
        return this;
      }
      this._state = 'playing';
      this._nodes[1].param('gain', 1);
      return this._nodes[0].start();
    };

    AudioBufferSource.prototype.stop = function() {
      var new_source;
      if (this._state === 'stopped') {
        return this;
      }
      this._state = 'stopped';
      this._nodes[1].param('gain', 0);
      new_source = this.context.createBufferSource();
      this.clone_AudioNode_properties(this._nodes[0], new_source);
      this.delete_node(0);
      this.insert_node(new_source, 0);
      this.expose_properties_of(this._nodes[0]);
      return this;
    };

    AudioBufferSource.prototype.clone_AudioNode_properties = function(source, dest) {
      var k, v;
      for (k in source) {
        v = source[k];
        switch (this.__typeof(source[k])) {
          case 'AudioBuffer':
          case 'boolean':
          case 'number':
          case 'string':
            dest[k] = v;
            break;
          case 'AudioParam':
            dest[k].value = v.value;
            break;
          case 'function':
            if (!source[k].toString().match(/native code/)) {
              dest[k] = v;
            }
        }
      }
      return null;
    };

    return AudioBufferSource;

  })(MooogAudioNode);

  BiquadFilter = (function(superClass) {
    extend(BiquadFilter, superClass);

    function BiquadFilter(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      BiquadFilter.__super__.constructor.apply(this, arguments);
    }

    BiquadFilter.prototype.before_config = function(config) {
      return this.insert_node(this.context.createBiquadFilter(), 0);
    };

    BiquadFilter.prototype.after_config = function(config) {};

    return BiquadFilter;

  })(MooogAudioNode);

  ChannelMerger = (function(superClass) {
    extend(ChannelMerger, superClass);

    function ChannelMerger(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      this.__numberOfInputs = config.numberOfInputs != null ? config.numberOfInputs : 6;
      delete config.numberOfInputs;
      ChannelMerger.__super__.constructor.apply(this, arguments);
    }

    ChannelMerger.prototype.before_config = function(config) {
      return this.insert_node(this.context.createChannelMerger(this.__numberOfInputs), 0);
    };

    ChannelMerger.prototype.after_config = function(config) {};

    return ChannelMerger;

  })(MooogAudioNode);

  ChannelSplitter = (function(superClass) {
    extend(ChannelSplitter, superClass);

    function ChannelSplitter(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      this.__numberOfOutputs = config.numberOfOutputs != null ? config.numberOfOutputs : 6;
      delete config.numberOfOutputs;
      ChannelSplitter.__super__.constructor.apply(this, arguments);
    }

    ChannelSplitter.prototype.before_config = function(config) {
      return this.insert_node(this.context.createChannelSplitter(this.__numberOfOutputs), 0);
    };

    ChannelSplitter.prototype.after_config = function(config) {};

    return ChannelSplitter;

  })(MooogAudioNode);

  Convolver = (function(superClass) {
    extend(Convolver, superClass);

    function Convolver(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      Convolver.__super__.constructor.apply(this, arguments);
    }

    Convolver.prototype.before_config = function(config) {
      this.insert_node(this.context.createConvolver(), 0);
      return this.define_buffer_source_properties();
    };

    Convolver.prototype.after_config = function(config) {};

    return Convolver;

  })(MooogAudioNode);

  Delay = (function(superClass) {
    extend(Delay, superClass);

    function Delay(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      Delay.__super__.constructor.apply(this, arguments);
    }

    Delay.prototype.before_config = function(config) {
      this.insert_node(this.context.createDelay(), 0);
      this._feedback_stage = new Gain(this._instance, {
        connect_to_destination: false,
        gain: 0
      });
      this._nodes[0].connect(this.to(this._feedback_stage));
      this._feedback_stage.connect(this.to(this._nodes[0]));
      return this.feedback = this._feedback_stage.gain;
    };

    Delay.prototype.after_config = function(config) {};

    return Delay;

  })(MooogAudioNode);

  DynamicsCompressor = (function(superClass) {
    extend(DynamicsCompressor, superClass);

    function DynamicsCompressor(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      DynamicsCompressor.__super__.constructor.apply(this, arguments);
    }

    DynamicsCompressor.prototype.before_config = function(config) {
      return this.insert_node(this.context.createDynamicsCompressor(), 0);
    };

    DynamicsCompressor.prototype.after_config = function(config) {};

    return DynamicsCompressor;

  })(MooogAudioNode);

  Gain = (function(superClass) {
    extend(Gain, superClass);

    function Gain(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      Gain.__super__.constructor.apply(this, arguments);
    }

    Gain.prototype.before_config = function(config) {
      this.insert_node(this.context.createGain(), 0);
      return this._nodes[0].gain.value = this._instance.config.default_gain;
    };

    Gain.prototype.after_config = function(config) {};

    return Gain;

  })(MooogAudioNode);

  MediaElementSource = (function(superClass) {
    extend(MediaElementSource, superClass);

    function MediaElementSource(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      MediaElementSource.__super__.constructor.apply(this, arguments);
    }

    MediaElementSource.prototype.before_config = function(config) {
      if (!config.mediaElement) {
        throw new Error("MediaElementSource requires mediaElement config argument");
      }
      if (typeof config.mediaElement === 'string') {
        config.mediaElement = document.querySelector(config.mediaElement);
      }
      return this.insert_node(this.context.createMediaElementSource(config.mediaElement), 0);
    };

    MediaElementSource.prototype.after_config = function(config) {};

    return MediaElementSource;

  })(MooogAudioNode);

  Oscillator = (function(superClass) {
    extend(Oscillator, superClass);

    function Oscillator(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      this.__start = bind(this.__start, this);
      this.__stop = bind(this.__stop, this);
      Oscillator.__super__.constructor.apply(this, arguments);
    }

    Oscillator.prototype.before_config = function(config) {
      return this.insert_node(this.context.createOscillator(), 0);
    };

    Oscillator.prototype.after_config = function(config) {
      this.insert_node(new Gain(this._instance, {
        connect_to_destination: this.config.connect_to_destination
      }));
      this._nodes[1].gain.value = 1.0;
      this._is_started = false;
      this._state = 'stopped';
      this._timeout = false;
      return this.define_readonly_property('state', (function(_this) {
        return function() {
          return _this._state;
        };
      })(this));
    };

    Oscillator.prototype.start = function(time) {
      if (time == null) {
        time = 0;
      }
      clearTimeout(this._timeout);
      if (this._state === 'playing') {
        return this;
      }
      if (time === 0) {
        this.__start(time);
      } else {
        this._timeout = setTimeout(this.__start, time * 1000);
      }
      return this;
    };

    Oscillator.prototype.stop = function(time) {
      if (time == null) {
        time = 0;
      }
      clearTimeout(this._timeout);
      if (this._state === 'stopped') {
        return this;
      }
      if (time === 0) {
        this.__stop();
      } else {
        this._timeout = setTimeout(this.__stop, time * 1000);
      }
      return this;
    };

    Oscillator.prototype.__stop = function() {
      this._state = 'stopped';
      this._nodes[1].gain.value = 0;
      return this;
    };

    Oscillator.prototype.__start = function() {
      this._state = 'playing';
      if (this._is_started) {
        this._nodes[1].gain.value = 1.0;
      } else {
        this._nodes[0].start(0);
        this._is_started = true;
      }
      return this;
    };

    return Oscillator;

  })(MooogAudioNode);

  Panner = (function(superClass) {
    extend(Panner, superClass);

    function Panner(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      Panner.__super__.constructor.apply(this, arguments);
    }

    Panner.prototype.before_config = function(config) {
      return this.insert_node(this.context.createPanner(), 0);
    };

    Panner.prototype.after_config = function(config) {};

    return Panner;

  })(MooogAudioNode);

  ScriptProcessor = (function(superClass) {
    extend(ScriptProcessor, superClass);

    function ScriptProcessor(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      this.__bufferSize = config.bufferSize != null ? config.bufferSize : null;
      this.__numberOfInputChannels = config.numberOfInputChannels != null ? config.numberOfInputChannels : 2;
      this.__numberOfOuputChannels = config.numberOfOuputChannels != null ? config.numberOfOuputChannels : 2;
      delete config.bufferSize;
      delete config.numberOfInputChannels;
      delete config.numberOfOuputChannels;
      this.debug("ScriptProcessorNode is deprecated and will be replaced by AudioWorker");
      ScriptProcessor.__super__.constructor.apply(this, arguments);
    }

    ScriptProcessor.prototype.before_config = function(config) {
      return this.insert_node(this.context.createScriptProcessor(this.__bufferSize, this.__numberOfInputChannels, this.__numberOfOuputChannels), 0);
    };

    ScriptProcessor.prototype.after_config = function(config) {};

    return ScriptProcessor;

  })(MooogAudioNode);

  StereoPanner = (function(superClass) {
    extend(StereoPanner, superClass);

    function StereoPanner(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      StereoPanner.__super__.constructor.apply(this, arguments);
    }

    StereoPanner.prototype.before_config = function(config) {
      return this.insert_node(this.context.createStereoPanner(), 0);
    };

    StereoPanner.prototype.after_config = function(config) {};

    return StereoPanner;

  })(MooogAudioNode);

  Track = (function(superClass) {
    extend(Track, superClass);

    function Track(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      this._sends = {};
      this.debug('initializing track object');
      config.node_type = 'Track';
      Track.__super__.constructor.apply(this, arguments);
    }

    Track.prototype.before_config = function(config) {
      this._pan_stage = this._instance.context.createStereoPanner();
      this._gain_stage = this._instance.context.createGain();
      this._gain_stage.gain.value = this._instance.config.default_gain;
      this._pan_stage.connect(this._gain_stage);
      this._gain_stage.connect(this._destination);
      this._destination = this._pan_stage;
      this.gain = this._gain_stage.gain;
      return this.pan = this._pan_stage.pan;
    };

    Track.prototype.after_config = function(config) {};

    Track.prototype.send = function(id, dest, pre, gain) {
      var new_send, source;
      if (pre == null) {
        pre = this._instance.config.default_send_type;
      }
      if (gain == null) {
        gain = this._instance.config.default_gain;
      }
      if (dest == null) {
        return this._sends[id];
      }
      source = pre === 'pre' ? this._nodes[this._nodes.length - 1] : this._gain_stage;
      if (this._sends[id] != null) {
        return this._sends[id];
      }
      this._sends[id] = new_send = new Gain(this._instance, {
        connect_to_destination: false,
        gain: gain
      });
      source.connect(this.to(new_send));
      new_send.connect(this.to(dest));
      return new_send;
    };

    return Track;

  })(MooogAudioNode);

  WaveShaper = (function(superClass) {
    extend(WaveShaper, superClass);

    function WaveShaper(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      WaveShaper.__super__.constructor.apply(this, arguments);
    }

    WaveShaper.prototype.before_config = function(config) {
      return this.insert_node(this.context.createWaveShaper(), 0);
    };

    WaveShaper.prototype.after_config = function(config) {};

    WaveShaper.prototype.chebyshev = function(terms, last, current) {
      var el, i, lasttemp, newcurrent;
      if (last == null) {
        last = [1];
      }
      if (current == null) {
        current = [1, 0];
      }
      if (terms < 2) {
        throw new Error("Terms must be 2 or more for chebyshev generator");
      }
      if (current.length === terms) {
        return this.poly.apply(this, current);
      } else {
        lasttemp = last;
        last = current;
        current = current.map(function(x) {
          return 2 * x;
        });
        current.push(0);
        lasttemp.unshift(0, 0);
        lasttemp = lasttemp.map(function(x) {
          return -1 * x;
        });
        newcurrent = (function() {
          var j, len, results;
          results = [];
          for (i = j = 0, len = current.length; j < len; i = ++j) {
            el = current[i];
            results.push(lasttemp[i] + current[i]);
          }
          return results;
        })();
        return this.chebyshev(terms, last, newcurrent);
      }
    };

    WaveShaper.prototype.poly = function() {
      var coeffs, curve, i, j, length, p, ref, step;
      coeffs = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      length = this._instance.config.curve_length;
      step = 2 / (length - 1);
      curve = new Float32Array(length);
      p = function(x, coeffs) {
        var a, accum, i, j, ref;
        accum = 0;
        for (i = j = 0, ref = coeffs.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
          a = coeffs[i];
          accum += a * Math.pow(x, coeffs.length - i - 1);
        }
        return accum;
      };
      for (i = j = 0, ref = length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        curve[i] = p((i * step) - 1, coeffs);
      }
      return curve;
    };

    WaveShaper.prototype.tanh = function(n) {
      var curve, i, j, length, ref, step;
      length = this._instance.config.curve_length;
      step = 2 / (length - 1);
      curve = new Float32Array(length);
      for (i = j = 0, ref = length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        curve[i] = Math.tanh((Math.PI / 2) * n * ((i * step) - 1));
      }
      return curve;
    };

    return WaveShaper;

  })(MooogAudioNode);

  Mooog = (function() {
    Mooog.LEGAL_NODES = {
      'Analyser': Analyser,
      'AudioBufferSource': AudioBufferSource,
      'BiquadFilter': BiquadFilter,
      'ChannelMerger': ChannelMerger,
      'ChannelSplitter': ChannelSplitter,
      'Convolver': Convolver,
      'Delay': Delay,
      'DynamicsCompressor': DynamicsCompressor,
      'Gain': Gain,
      'MediaElementSource': MediaElementSource,
      'Oscillator': Oscillator,
      'Panner': Panner,
      'ScriptProcessor': ScriptProcessor,
      'StereoPanner': StereoPanner,
      'WaveShaper': WaveShaper
    };

    Mooog.MooogAudioNode = MooogAudioNode;

    function Mooog(initConfig1) {
      this.initConfig = initConfig1 != null ? initConfig1 : {};
      this.config = {
        debug: false,
        default_gain: 0.5,
        default_ramp_type: 'expo',
        default_send_type: 'post',
        periodic_wave_length: 2048,
        curve_length: 65536,
        fake_zero: 1 / 65536,
        allow_multiple_audiocontexts: false
      };
      this._BROWSER_CONSTRUCTOR = false;
      this.context = this.create_context();
      this._destination = this.context.destination;
      this.init(this.initConfig);
      Mooog.browser_test();
      this.iOS_setup();
      this._nodes = {};
      this.__typeof = MooogAudioNode.prototype.__typeof;
      if (!Mooog.browser_test().all) {
        console.log("AudioContext not fully supported in this browser. Run Mooog.browser_test() for more info");
      }
    }

    Mooog.prototype.iOS_setup = function() {
      var body, instantProcess, is_iOS, tmpBuf, tmpProc;
      is_iOS = navigator.userAgent.indexOf('like Mac OS X') !== -1;
      if (is_iOS) {
        body = document.body;
        tmpBuf = this.context.createBufferSource();
        tmpProc = this.context.createScriptProcessor(256, 1, 1);
        instantProcess = (function(_this) {
          return function() {
            tmpBuf.start(0);
            tmpBuf.connect(tmpProc);
            return tmpProc.connect(_this.context.destination);
          };
        })(this);
        body.addEventListener('touchstart', instantProcess, false);
        return tmpProc.onaudioprocess = function() {
          tmpBuf.disconnect();
          tmpProc.disconnect();
          body.removeEventListener('touchstart', instantProcess, false);
          return tmpProc.onaudioprocess = null;
        };
      }
    };

    Mooog.prototype.init = function(initConfig) {
      var key, ref, val;
      ref = this.config;
      for (key in ref) {
        val = ref[key];
        if (initConfig[key] != null) {
          this.config[key] = initConfig[key];
        }
      }
      return null;
    };

    Mooog.context = false;

    Mooog.prototype.create_context = function() {
      this._BROWSER_CONSTRUCTOR = (function() {
        switch (false) {
          case window.AudioContext == null:
            return 'AudioContext';
          case window.webkitAudioContext == null:
            return 'webkitAudioContext';
          default:
            throw new Error("This browser does not yet support the AudioContext API");
        }
      })();
      if (this.config.allow_multiple_audiocontexts) {
        return new window[this._BROWSER_CONSTRUCTOR];
      }
      return Mooog.context || (Mooog.context = new window[this._BROWSER_CONSTRUCTOR]);
    };

    Mooog.prototype.track = function() {
      var id, node_list, ref;
      id = arguments[0], node_list = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if (!arguments.length) {
        return new Track(this);
      }
      if (typeof id === 'string') {
        if (node_list.length) {
          if (this._nodes[id] != null) {
            throw new Error(id + " is already assigned to " + this._nodes[id]);
          }
          this._nodes[id] = new Track(this, {
            id: id
          });
          this._nodes[id].add(node_list);
          return this._nodes[id];
        } else if (((ref = this._nodes) != null ? ref[id] : void 0) != null) {
          return this._nodes[id];
        } else {
          throw new Error("No Track found with id " + id);
        }
      } else {
        throw new Error("Track id must be a string");
      }
    };

    Mooog.prototype.node = function() {
      var arg0, arg1, i, j, len, new_node, results, type0, type1;
      arg0 = arguments[0];
      arg1 = arguments[1];
      type0 = this.__typeof(arg0);
      type1 = this.__typeof(arg1);
      if (type0 === "string" && type1 === "string") {
        if (Mooog.LEGAL_NODES[arg1] != null) {
          if (this._nodes[arg0]) {
            throw new Error(arg0 + " is already assigned to " + this._nodes[arg0]);
          }
          return this._nodes[arg0] = new Mooog.LEGAL_NODES[arg1](this, {
            id: arg0,
            node_type: arg1
          });
        } else {
          console.log(arguments);
          throw new Error("Unknown node type " + arg1);
        }
      } else if (type0 === "string" && type1 === "undefined") {
        if (this._nodes[arg0]) {
          return this._nodes[arg0];
        } else {
          throw new Error("No MooogAudioNode found with id " + arg0);
        }
      } else if (type0 === "object" && type1 === "undefined") {
        if (this._nodes[arg0.id]) {
          throw new Error(arg0.id + " is already assigned to " + this._nodes[arg0.id]);
        } else if (Mooog.LEGAL_NODES[arg0.node_type] != null) {
          new_node = new Mooog.LEGAL_NODES[arg0.node_type](this, arg0);
          return this._nodes[new_node.id] = new_node;
        } else {
          throw new Error("Omitted or undefined node type in config options.");
        }
      } else if (type0 === "object" && type1 === "object") {
        throw new Error("A string id for the base node must be provided if you give more than one node definition");
      } else if (type0 === "string" && type1 === "object") {
        new_node = new MooogAudioNode(this, {
          id: arg0
        });
        this._nodes[new_node.id] = new_node;
        results = [];
        for (j = 0, len = arguments.length; j < len; j++) {
          i = arguments[j];
          results.push(new_node.add(new MooogAudioNode(this, i)));
        }
        return results;
      }
    };

    Mooog.extend_with = function(nodeName, nodeDef) {
      window.nodeDef = nodeDef;
      if (nodeDef.prototype.before_config == null) {
        throw new Error("Node definition prototype must have a before_config function");
      }
      if (nodeDef.prototype.after_config == null) {
        throw new Error("Node definition prototype must have a before_config function");
      }
      if (Mooog.LEGAL_NODES[nodeName] != null) {
        throw new Error(nodeName + " class already defined");
      }
      Mooog.LEGAL_NODES[nodeName] = nodeDef;
      return null;
    };

    Mooog.freq = function(n) {
      return 440 * Math.pow(2, (n - 69) / 12);
    };

    Mooog.prototype.sawtoothPeriodicWave = function(harms) {
      var a, i, imag, j, real, ref;
      if (harms == null) {
        harms = this.config.periodic_wave_length;
      }
      a = [0];
      for (i = j = 1, ref = harms - 1; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        a.push(1 / i);
      }
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    Mooog.prototype.squarePeriodicWave = function(harms) {
      var a, i, imag, j, real, ref;
      if (harms == null) {
        harms = this.config.periodic_wave_length;
      }
      a = [0];
      for (i = j = 1, ref = harms - 1; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        if (i % 2 !== 0) {
          a.push(2 / (Math.PI * i));
        } else {
          a.push(0);
        }
      }
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    Mooog.prototype.trianglePeriodicWave = function(harms) {
      var a, i, imag, j, real, ref;
      if (harms == null) {
        harms = this.config.periodic_wave_length;
      }
      a = [0];
      for (i = j = 1, ref = harms - 1; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        if (i % 2 !== 0) {
          a.push(1 / (Math.pow(i, 2)));
        } else {
          a.push(0);
        }
      }
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    Mooog.prototype.sinePeriodicWave = function(harms) {
      var a, imag, real;
      a = [0, 1];
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    Mooog.brower_test_results = false;

    Mooog.browser_test = function() {
      var __t, ctxt, error, tests;
      if (this.browser_test_results) {
        return this.browser_test_results;
      }
      tests = {
        all: true
      };
      ctxt = window.AudioContext || window.webkitAudioContext;
      tests.all = (tests.audio_context = !!ctxt) ? tests.all : false;
      if (!ctxt) {
        return false;
      }
      __t = new ctxt();
      tests.all = (tests.unprefixed = window.AudioContext != null) ? tests.all : false;
      tests.all = (tests.start_stop = __t.createOscillator().start != null) ? tests.all : false;
      if (__t.createStereoPanner != null) {
        tests.stereo_panner = true;
      } else {
        try {
          this.patch_StereoPanner();
          tests.stereo_panner = 'patched';
        } catch (_error) {
          error = _error;
          test.stereo_panner = false;
          tests.all = false;
        }
      }
      tests.all = (tests.script_processor = __t.createScriptProcessor != null) ? tests.all : false;
      return this.browser_test_results = tests;
    };

    Mooog.patch_StereoPanner = function() {
      var StereoPannerImpl, WS_CURVE_SIZE, ctxt, curveL, curveR, i, j, ref;
      WS_CURVE_SIZE = 4096;
      curveL = new Float32Array(WS_CURVE_SIZE);
      curveR = new Float32Array(WS_CURVE_SIZE);
      for (i = j = 0, ref = WS_CURVE_SIZE; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        curveL[i] = Math.cos((i / WS_CURVE_SIZE) * Math.PI * 0.5);
        curveR[i] = Math.sin((i / WS_CURVE_SIZE) * Math.PI * 0.5);
      }

      /*
          
       *  StereoPannerImpl
       *  +--------------------------------+  +------------------------+
       *  | ChannelSplitter(inlet)         |  | BufferSourceNode(_dc1) |
       *  +--------------------------------+  | buffer: [ 1, 1 ]       |
       *    |                            |    | loop: true             |
       *    |                            |    +------------------------+
       *    |                            |       |
       *    |                            |  +----------------+
       *    |                            |  | GainNode(_pan) |
       *    |                            |  | gain: 0(pan)   |
       *    |                            |  +----------------+
       *    |                            |    |
       *    |    +-----------------------|----+
       *    |    |                       |    |
       *    |  +----------------------+  |  +----------------------+
       *    |  | WaveShaperNode(_wsL) |  |  | WaveShaperNode(_wsR) |
       *    |  | curve: curveL        |  |  | curve: curveR        |
       *    |  +----------------------+  |  +----------------------+
       *    |               |            |               |
       *    |               |            |               |
       *    |               |            |               |
       *  +--------------+  |          +--------------+  |
       *  | GainNode(_L) |  |          | GainNode(_R) |  |
       *  | gain: 0    <----+          | gain: 0    <----+
       *  +--------------+             +--------------+
       *    |                            |
       *  +--------------------------------+
       *  | ChannelMergerNode(outlet)      |
       *  +--------------------------------+
       */
      StereoPannerImpl = (function() {
        function StereoPannerImpl(audioContext) {
          this.audioContext = audioContext;
          this.inlet = audioContext.createChannelSplitter(2);
          this._pan = audioContext.createGain();
          this.pan = this._pan.gain;
          this._wsL = audioContext.createWaveShaper();
          this._wsR = audioContext.createWaveShaper();
          this._L = audioContext.createGain();
          this._R = audioContext.createGain();
          this.outlet = audioContext.createChannelMerger(2);
          this.inlet.channelCount = 2;
          this.inlet.channelCountMode = "explicit";
          this._pan.gain.value = 0;
          this._wsL.curve = curveL;
          this._wsR.curve = curveR;
          this._L.gain.value = 0;
          this._R.gain.value = 0;
          this.inlet.connect(this._L, 0);
          this.inlet.connect(this._R, 1);
          this._L.connect(this.outlet, 0, 0);
          this._R.connect(this.outlet, 0, 1);
          this._pan.connect(this._wsL);
          this._pan.connect(this._wsR);
          this._wsL.connect(this._L.gain);
          this._wsR.connect(this._R.gain);
          this._isConnected = false;
          this._dc1buffer = null;
          this._dc1 = null;
        }

        StereoPannerImpl.prototype.connect = function(destination) {
          var audioContext;
          audioContext = this.audioContext;
          if (!this._isConnected) {
            this._isConnected = true;
            this._dc1buffer = audioContext.createBuffer(1, 2, audioContext.sampleRate);
            this._dc1buffer.getChannelData(0).set([1, 1]);
            this._dc1 = audioContext.createBufferSource();
            this._dc1.buffer = this._dc1buffer;
            this._dc1.loop = true;
            this._dc1.start(audioContext.currentTime);
            this._dc1.connect(this._pan);
          }
          return AudioNode.prototype.connect.call(this.outlet, destination);
        };

        StereoPannerImpl.prototype.disconnect = function() {
          this.audioContext;
          if (this._isConnected) {
            this._isConnected = false;
            this._dc1.stop(audioContext.currentTime);
            this._dc1.disconnect();
            this._dc1 = null;
            this._dc1buffer = null;
          }
          return AudioNode.prototype.disconnect.call(this.outlet);
        };

        return StereoPannerImpl;

      })();
      StereoPanner = (function() {
        function StereoPanner(audioContext) {
          var impl;
          impl = new StereoPannerImpl(audioContext);
          Object.defineProperties(impl.inlet, {
            pan: {
              value: impl.pan,
              enumerable: true
            },
            connect: {
              value: function(node) {
                return impl.connect(node);
              }
            },
            disconnect: {
              value: function() {
                return impl.disconnect();
              }
            }
          });
          return impl.inlet;
        }

        return StereoPanner;

      })();
      ctxt = window.AudioContext || window.webkitAudioContext;
      if (!ctxt || ctxt.prototype.hasOwnProperty("createStereoPanner")) {

      } else {
        return ctxt.prototype.createStereoPanner = function() {
          return new StereoPanner(this);
        };
      }
    };

    return Mooog;

  })();

  window.Mooog = Mooog;

}).call(this);

var individuals = [57821,57705,57592,57714,57915,57941,57974,58034,57892,57830,57995,58066,58101,58039,58116,58091,58016,58153,58247,58231,58245,58288,58143,58043,58227,58277,58318,58351,58336,58217,58104,58091,58276,58225,58208,58183,58118,58014,58081,58191,58231,58143,58128,58184,58133,58191,58209,58203,58301,58395,58395,58169,58283,57983,58305,58439,58370,58260,58064,58155,58355,58290,58242,58158,58077,57920,58013,58137,58086,58008,57929,57788,57678,57629,57338,57914,57838,57896,57730,57699,57711,57689,57902,57985,58009,57953,57854,57881,58036,58026,57965,57998,57971,57830,57852,58070,57984,57978,57967,57836,57716,57637,57769,57753,57733,57967,57855,57907,57993,57956,57962,57954,58037,57895,57742,57926,57905,57930,57903,57856,57700,57676,57801,57774,57805,57722,57756,57543,57447,57419,57478,57484,57451,57407,57414,57456,57618,57575,57410,57460,57369,57428,57397,57448,57410,57423,57546,57386,57320,57314,57300,57353,57460,57364,57170,57124,57255,57182,57259,57239,57276,57202,57105,57218,57237,57366,57285,57364,57272,57121,57241,57223,57206,57209,57059,57059,57070,57059,57162,57209,57264,57206,57224,57140,56928,57102,57047,56949,56970,56963,56725,56706,56730,56763,56720,56635,56731,56715,56583,56542,56744,56647,56713,56741,56690,56572,56629,56673,56628,56444,56564,56593,56493,56597,56544,56485,56407,56421,56226,56029,56111,56173,56242,56133,56284,56284,56135,55949,55965,56170,56174,56043,56100,56052,55926,55915,55985,56069,56073,56085,56071,55938,56133,56227,56091,55979,55997,55891,55764,55837,55913,55896,55821,55834,55804,55704,55702,55809,55889,55941,55941,55977,55932,55949,56098,56158,56137,56167,56143,56077,56070,56162,56186,56219,56322,56230,56143,56262,56314,56361,56362,56435,56378,56355,56410,56496,56506,56448,56562,56440,56352,56487,56527,56539,56611,56622,56680,56651,56840,56809,56655,56729,56734,56714,56583,56723,56670,56631,56701,56768,56755,56602,56640,56670,56427,56555,56810,56854,56847,56876,56907,56796,56824,56921,56880,56972,56911,56727,56911,57098,57211,57234,57125,57148,56954,57014,57201,57125,57025,57147,57181,57034,57001,57047,57089,57166,57333,57330,57191,57303,57405,57557,57536,57622,57675,57528,57624,57655,57720,57718,57757,57775,45993,57783,58027,57969,57911,57866,57872,57909,57819,57963,57961,57839,57927,57975,58083,58073,58142,58156,58104,58211,58269,58284,58344,58292,58292,58210,58089,58230,58267,58288,58329,58429,58262,58346,58350,46794,58587,58479,58413,58506,58614,58614,58723,58732,58602,58627,58472,58545,58655,58645,58714,58691,58644,58520,58624,58667,58640,58628,58643,58583,58487,58428,58551,58474,58352,58369,58330,58172,58180,58142,57941,58310,58541,58516,58504,58586,58549,58499,58736,58913,58944,58820,58929,59050,59068,58959,59032,59019,58870,58915,58959,58945,58939,58898,58853,58700,58706,58741,58652,58506,58484,58555,58521,58535,58457,58493,58525,58504,58469,58469,58491,58491,58532,58532,58562,58477,58354,58351,58326,58258,58139,58174,58143,58060,58032,58054,57878,57676,57648,57646,57729,57665,57645,57551,57530,57586,57540,57480,57490,57548,57343,57364,57432,57390,57323,57343,57328,57115,56993,56992,57060,56934,56749,56701,56676,56329,56274,56373,56190,56143,56220,56285,56219,56348,56288,56108,56145,56112,56017,56034,56014,56082,55784,55768,55727,55728,55552,55616,55498,55342,55222,55222,55050,55221,55174,55029,54929,54873,55036,55025,54979,55076,55097,54930,54944,54964,54920,54889,54874,54830,54617,54730,54793,54801,54851,54855,54945,54648,54726,54737,54711,54645,54765,54712,54471,54467,54742,54759,54763,44252,54783,54554,54602,54706,54605,54421,54581,54602,54421,54374,54427,54404,54439,54417,54395,54125,54145,54102,54091,53968,53927,53892,53717,53608,53658,63714,53742,53928,53986,53804,53736,53894,53733,53719,53835,53767,53650,53754,53630,53547,53586,53595,53544,53481,53513,53505,53336,53344,53352,53320,53324,53374,53383,53197,53212,53310,53327,53341,53265,53247,53243,53330,53377,53419,53339,53393,53402,53198,53121,53242,53195,53106,53118,53030,52887,52867,52919,52835,52793,52839,52748,52517,52536,52685,52807,52807,52804,52740,52583,52510,52602,52615,52516,52613,52591,52428,52430,52566,52585,52487,52438,52462,52254,52271,52302,52319,52309,53540,53511,53276,53288,53274,53345,52169,52420,52495,52328,52286,52425,52422,52367,52407,52389,52162,52152,52270,52299,52232,52293,52253,52011,52071,52147,52147,52010,52157,52211,52031,52070,52128,52118,52271,52295,52167,52184,52354,52338,52261,52301,52249,52074,62359,52171,52261,52325,52270,52165,52069,52153,52319,52137,52166,52164,52084,51992,52162,52199,52137,52077,51943,51724,51668,51909,52231,52247,52178,52168,52121,51927,51907,51882,51809,51649,51585,51472,51319,51371,51413,51344,51227,51345,51261,51054,51125,51352,51319,51082,50910,50957,50957,50954,50797,50689,50370,50927,50994,50787,50861,51013,50965,50818,51082,50992,50851,50871,51151,51183,51215,51152,51020,51073,51203,51174,51156,51314,51237,50999,50926,50971,50909,50929,51093,51218,56380,50976,51076,51283,51346,51489,51422,51198,51214,51380,51377,62392,51376,51185,51110,61316,51166,51066,50918,50960,51028,50985,50941,50912,50881,50658,50733,51061,51163,51222,51263,51262,51055,51012,51153,51052,50994,51062,51059,50816,50732,50762,50772,50892,50962,50865,50593,50674,50728,50686,50602,50637,50581,50324,50339,50351,50315,50646,50595,50434,50486,50692,50584,50525,50608,50461,50282,50378,50414,50450,50452,50526,50540,50250,50218,50240,50151,50149,50123,49957,49912,49747,49751,49781,49662,49462,49525,49808,49753,49736,49877,49858,49617,49548,49690,49673];

var individuals_perc =  [0.6972,0.6912,0.6854,0.6917,0.702,0.7034,0.7051,0.7081,0.7009,0.6977,0.7061,0.7098,0.7116,0.7084,0.7124,0.7111,0.7072,0.7143,0.7191,0.7183,0.719,0.7212,0.7137,0.7086,0.7181,0.7206,0.7227,0.7244,0.7237,0.7176,0.7117,0.7111,0.7206,0.718,0.7171,0.7158,0.7125,0.7071,0.7106,0.7162,0.7183,0.7137,0.713,0.7159,0.7132,0.7162,0.7171,0.7168,0.7219,0.7267,0.7267,0.7151,0.7209,0.7055,0.7221,0.729,0.7254,0.7198,0.7097,0.7144,0.7246,0.7213,0.7188,0.7145,0.7104,0.7023,0.7071,0.7134,0.7108,0.7068,0.7028,0.6955,0.6899,0.6873,0.6724,0.702,0.6981,0.7011,0.6925,0.6909,0.6916,0.6904,0.7014,0.7056,0.7069,0.704,0.6989,0.7003,0.7083,0.7077,0.7046,0.7063,0.7049,0.6977,0.6988,0.71,0.7056,0.7053,0.7047,0.698,0.6918,0.6878,0.6945,0.6937,0.6927,0.7047,0.699,0.7016,0.706,0.7041,0.7044,0.704,0.7083,0.701,0.6931,0.7026,0.7015,0.7028,0.7014,0.699,0.691,0.6898,0.6962,0.6948,0.6964,0.6921,0.6939,0.6829,0.678,0.6765,0.6796,0.6799,0.6782,0.6759,0.6763,0.6785,0.6868,0.6846,0.6761,0.6787,0.674,0.677,0.6754,0.678,0.6761,0.6768,0.6831,0.6749,0.6715,0.6712,0.6704,0.6732,0.6787,0.6737,0.6638,0.6614,0.6681,0.6644,0.6683,0.6673,0.6692,0.6654,0.6604,0.6662,0.6672,0.6738,0.6697,0.6737,0.669,0.6612,0.6674,0.6665,0.6656,0.6658,0.6581,0.6581,0.6586,0.6581,0.6633,0.6658,0.6686,0.6656,0.6665,0.6622,0.6513,0.6603,0.6574,0.6524,0.6535,0.6531,0.6409,0.6399,0.6411,0.6428,0.6406,0.6363,0.6412,0.6404,0.6336,0.6315,0.6419,0.6369,0.6403,0.6417,0.6391,0.633,0.636,0.6382,0.6359,0.6265,0.6326,0.6341,0.629,0.6343,0.6316,0.6286,0.6246,0.6253,0.6153,0.6051,0.6093,0.6125,0.6161,0.6105,0.6182,0.6182,0.6106,0.601,0.6018,0.6124,0.6126,0.6058,0.6088,0.6063,0.5998,0.5993,0.6029,0.6072,0.6074,0.608,0.6073,0.6005,0.6105,0.6153,0.6083,0.6026,0.6035,0.598,0.5915,0.5953,0.5992,0.5983,0.5944,0.5951,0.5936,0.5884,0.5883,0.5938,0.5979,0.6006,0.6006,0.6025,0.6001,0.601,0.6087,0.6118,0.6107,0.6122,0.611,0.6076,0.6072,0.612,0.6132,0.6149,0.6202,0.6155,0.611,0.6171,0.6198,0.6222,0.6222,0.626,0.6231,0.6219,0.6247,0.6291,0.6296,0.6267,0.6325,0.6262,0.6217,0.6287,0.6307,0.6313,0.635,0.6356,0.6386,0.6371,0.6468,0.6452,0.6373,0.6411,0.6414,0.6403,0.6336,0.6408,0.6381,0.6361,0.6397,0.6431,0.6424,0.6346,0.6365,0.6381,0.6256,0.6322,0.6453,0.6475,0.6472,0.6486,0.6502,0.6445,0.646,0.651,0.6489,0.6536,0.6504,0.641,0.6504,0.6601,0.6659,0.667,0.6614,0.6626,0.6527,0.6557,0.6653,0.6614,0.6563,0.6626,0.6643,0.6568,0.6551,0.6574,0.6596,0.6635,0.6721,0.672,0.6648,0.6706,0.6758,0.6836,0.6826,0.687,0.6897,0.6821,0.6871,0.6887,0.692,0.6919,0.6939,0.6948,0.0895,0.6953,0.7078,0.7048,0.7018,0.6995,0.6998,0.7017,0.6971,0.7045,0.7044,0.6981,0.7027,0.7051,0.7107,0.7102,0.7137,0.7144,0.7117,0.7172,0.7202,0.721,0.7241,0.7214,0.7214,0.7172,0.711,0.7182,0.7201,0.7212,0.7233,0.7284,0.7199,0.7242,0.7244,0.1306,0.7366,0.731,0.7276,0.7324,0.738,0.738,0.7436,0.744,0.7373,0.7386,0.7307,0.7344,0.7401,0.7395,0.7431,0.7419,0.7395,0.7331,0.7385,0.7407,0.7393,0.7387,0.7394,0.7364,0.7314,0.7284,0.7347,0.7308,0.7245,0.7254,0.7234,0.7152,0.7157,0.7137,0.7034,0.7223,0.7342,0.7329,0.7323,0.7365,0.7346,0.732,0.7442,0.7533,0.7549,0.7485,0.7541,0.7604,0.7613,0.7557,0.7594,0.7588,0.7511,0.7534,0.7557,0.755,0.7547,0.7525,0.7502,0.7424,0.7427,0.7445,0.7399,0.7324,0.7313,0.7349,0.7332,0.7339,0.7299,0.7317,0.7334,0.7323,0.7305,0.7305,0.7316,0.7316,0.7337,0.7337,0.7353,0.7309,0.7246,0.7244,0.7232,0.7197,0.7135,0.7153,0.7137,0.7095,0.708,0.7092,0.7001,0.6898,0.6883,0.6882,0.6925,0.6892,0.6882,0.6833,0.6823,0.6851,0.6828,0.6797,0.6802,0.6832,0.6726,0.6737,0.6772,0.6751,0.6716,0.6726,0.6719,0.6609,0.6547,0.6546,0.6581,0.6516,0.6421,0.6397,0.6384,0.6205,0.6177,0.6228,0.6134,0.611,0.6149,0.6183,0.6149,0.6215,0.6184,0.6092,0.6111,0.6094,0.6045,0.6054,0.6044,0.6079,0.5925,0.5917,0.5896,0.5897,0.5806,0.5839,0.5778,0.5698,0.5637,0.5637,0.5548,0.5636,0.5612,0.5537,0.5486,0.5457,0.5541,0.5535,0.5512,0.5562,0.5572,0.5487,0.5494,0.5504,0.5481,0.5466,0.5458,0.5435,0.5326,0.5384,0.5416,0.542,0.5446,0.5448,0.5494,0.5342,0.5382,0.5387,0.5374,0.534,0.5402,0.5375,0.5251,0.5249,0.539,0.5399,0.5401,0.0,0.5411,0.5293,0.5318,0.5371,0.532,0.5225,0.5307,0.5318,0.5225,0.5201,0.5228,0.5216,0.5234,0.5223,0.5212,0.5073,0.5083,0.5061,0.5055,0.4992,0.4971,0.4953,0.4863,0.4807,0.4833,1.0,0.4876,0.4972,0.5002,0.4908,0.4873,0.4954,0.4872,0.4864,0.4924,0.4889,0.4829,0.4882,0.4819,0.4776,0.4796,0.4801,0.4774,0.4742,0.4759,0.4754,0.4668,0.4672,0.4676,0.4659,0.4661,0.4687,0.4692,0.4596,0.4604,0.4654,0.4663,0.467,0.4631,0.4622,0.462,0.4664,0.4689,0.471,0.4669,0.4697,0.4701,0.4597,0.4557,0.4619,0.4595,0.4549,0.4556,0.451,0.4437,0.4427,0.4453,0.441,0.4389,0.4412,0.4365,0.4247,0.4256,0.4333,0.4396,0.4396,0.4394,0.4361,0.4281,0.4243,0.429,0.4297,0.4246,0.4296,0.4285,0.4201,0.4202,0.4272,0.4282,0.4231,0.4206,0.4218,0.4112,0.412,0.4136,0.4145,0.414,0.4772,0.4757,0.4637,0.4643,0.4636,0.4672,0.4068,0.4197,0.4235,0.415,0.4128,0.4199,0.4198,0.417,0.419,0.4181,0.4064,0.4059,0.412,0.4135,0.41,0.4132,0.4111,0.3987,0.4018,0.4057,0.4057,0.3986,0.4062,0.409,0.3997,0.4017,0.4047,0.4042,0.412,0.4133,0.4067,0.4076,0.4163,0.4155,0.4115,0.4136,0.4109,0.4019,0.9304,0.4069,0.4115,0.4148,0.412,0.4066,0.4017,0.406,0.4145,0.4051,0.4066,0.4065,0.4024,0.3977,0.4064,0.4083,0.4051,0.4021,0.3952,0.3839,0.3811,0.3934,0.41,0.4108,0.4073,0.4067,0.4043,0.3944,0.3933,0.392,0.3883,0.3801,0.3768,0.371,0.3631,0.3658,0.3679,0.3644,0.3584,0.3645,0.3601,0.3495,0.3531,0.3648,0.3631,0.3509,0.3421,0.3445,0.3445,0.3444,0.3363,0.3307,0.3144,0.343,0.3464,0.3358,0.3396,0.3474,0.3449,0.3374,0.3509,0.3463,0.3391,0.3401,0.3545,0.3561,0.3578,0.3545,0.3478,0.3505,0.3572,0.3557,0.3547,0.3629,0.3589,0.3467,0.3429,0.3452,0.3421,0.3431,0.3515,0.3579,0.6232,0.3455,0.3506,0.3613,0.3645,0.3719,0.3684,0.3569,0.3577,0.3663,0.3661,0.9321,0.366,0.3562,0.3524,0.8768,0.3553,0.3501,0.3425,0.3447,0.3482,0.346,0.3437,0.3422,0.3406,0.3292,0.333,0.3499,0.3551,0.3581,0.3602,0.3602,0.3496,0.3473,0.3546,0.3494,0.3464,0.3499,0.3498,0.3373,0.333,0.3345,0.335,0.3412,0.3448,0.3398,0.3258,0.33,0.3328,0.3306,0.3263,0.3281,0.3252,0.312,0.3128,0.3134,0.3115,0.3285,0.3259,0.3176,0.3203,0.3309,0.3254,0.3223,0.3266,0.319,0.3098,0.3148,0.3166,0.3185,0.3186,0.3224,0.3231,0.3082,0.3065,0.3077,0.3031,0.303,0.3017,0.2931,0.2908,0.2823,0.2826,0.2841,0.278,0.2677,0.2709,0.2855,0.2827,0.2818,0.289,0.288,0.2757,0.2721,0.2794,0.2785];



/*! jQuery v2.2.1 | (c) jQuery Foundation | jquery.org/license */

!function(a,b){"object"==typeof module&&"object"==typeof module.exports?module.exports=a.document?b(a,!0):function(a){if(!a.document)throw new Error("jQuery requires a window with a document");return b(a)}:b(a)}("undefined"!=typeof window?window:this,function(a,b){var c=[],d=a.document,e=c.slice,f=c.concat,g=c.push,h=c.indexOf,i={},j=i.toString,k=i.hasOwnProperty,l={},m="2.2.1",n=function(a,b){return new n.fn.init(a,b)},o=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,p=/^-ms-/,q=/-([\da-z])/gi,r=function(a,b){return b.toUpperCase()};n.fn=n.prototype={jquery:m,constructor:n,selector:"",length:0,toArray:function(){return e.call(this)},get:function(a){return null!=a?0>a?this[a+this.length]:this[a]:e.call(this)},pushStack:function(a){var b=n.merge(this.constructor(),a);return b.prevObject=this,b.context=this.context,b},each:function(a){return n.each(this,a)},map:function(a){return this.pushStack(n.map(this,function(b,c){return a.call(b,c,b)}))},slice:function(){return this.pushStack(e.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(a){var b=this.length,c=+a+(0>a?b:0);return this.pushStack(c>=0&&b>c?[this[c]]:[])},end:function(){return this.prevObject||this.constructor()},push:g,sort:c.sort,splice:c.splice},n.extend=n.fn.extend=function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!1;for("boolean"==typeof g&&(j=g,g=arguments[h]||{},h++),"object"==typeof g||n.isFunction(g)||(g={}),h===i&&(g=this,h--);i>h;h++)if(null!=(a=arguments[h]))for(b in a)c=g[b],d=a[b],g!==d&&(j&&d&&(n.isPlainObject(d)||(e=n.isArray(d)))?(e?(e=!1,f=c&&n.isArray(c)?c:[]):f=c&&n.isPlainObject(c)?c:{},g[b]=n.extend(j,f,d)):void 0!==d&&(g[b]=d));return g},n.extend({expando:"jQuery"+(m+Math.random()).replace(/\D/g,""),isReady:!0,error:function(a){throw new Error(a)},noop:function(){},isFunction:function(a){return"function"===n.type(a)},isArray:Array.isArray,isWindow:function(a){return null!=a&&a===a.window},isNumeric:function(a){var b=a&&a.toString();return!n.isArray(a)&&b-parseFloat(b)+1>=0},isPlainObject:function(a){return"object"!==n.type(a)||a.nodeType||n.isWindow(a)?!1:a.constructor&&!k.call(a.constructor.prototype,"isPrototypeOf")?!1:!0},isEmptyObject:function(a){var b;for(b in a)return!1;return!0},type:function(a){return null==a?a+"":"object"==typeof a||"function"==typeof a?i[j.call(a)]||"object":typeof a},globalEval:function(a){var b,c=eval;a=n.trim(a),a&&(1===a.indexOf("use strict")?(b=d.createElement("script"),b.text=a,d.head.appendChild(b).parentNode.removeChild(b)):c(a))},camelCase:function(a){return a.replace(p,"ms-").replace(q,r)},nodeName:function(a,b){return a.nodeName&&a.nodeName.toLowerCase()===b.toLowerCase()},each:function(a,b){var c,d=0;if(s(a)){for(c=a.length;c>d;d++)if(b.call(a[d],d,a[d])===!1)break}else for(d in a)if(b.call(a[d],d,a[d])===!1)break;return a},trim:function(a){return null==a?"":(a+"").replace(o,"")},makeArray:function(a,b){var c=b||[];return null!=a&&(s(Object(a))?n.merge(c,"string"==typeof a?[a]:a):g.call(c,a)),c},inArray:function(a,b,c){return null==b?-1:h.call(b,a,c)},merge:function(a,b){for(var c=+b.length,d=0,e=a.length;c>d;d++)a[e++]=b[d];return a.length=e,a},grep:function(a,b,c){for(var d,e=[],f=0,g=a.length,h=!c;g>f;f++)d=!b(a[f],f),d!==h&&e.push(a[f]);return e},map:function(a,b,c){var d,e,g=0,h=[];if(s(a))for(d=a.length;d>g;g++)e=b(a[g],g,c),null!=e&&h.push(e);else for(g in a)e=b(a[g],g,c),null!=e&&h.push(e);return f.apply([],h)},guid:1,proxy:function(a,b){var c,d,f;return"string"==typeof b&&(c=a[b],b=a,a=c),n.isFunction(a)?(d=e.call(arguments,2),f=function(){return a.apply(b||this,d.concat(e.call(arguments)))},f.guid=a.guid=a.guid||n.guid++,f):void 0},now:Date.now,support:l}),"function"==typeof Symbol&&(n.fn[Symbol.iterator]=c[Symbol.iterator]),n.each("Boolean Number String Function Array Date RegExp Object Error Symbol".split(" "),function(a,b){i["[object "+b+"]"]=b.toLowerCase()});function s(a){var b=!!a&&"length"in a&&a.length,c=n.type(a);return"function"===c||n.isWindow(a)?!1:"array"===c||0===b||"number"==typeof b&&b>0&&b-1 in a}var t=function(a){var b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u="sizzle"+1*new Date,v=a.document,w=0,x=0,y=ga(),z=ga(),A=ga(),B=function(a,b){return a===b&&(l=!0),0},C=1<<31,D={}.hasOwnProperty,E=[],F=E.pop,G=E.push,H=E.push,I=E.slice,J=function(a,b){for(var c=0,d=a.length;d>c;c++)if(a[c]===b)return c;return-1},K="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",L="[\\x20\\t\\r\\n\\f]",M="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",N="\\["+L+"*("+M+")(?:"+L+"*([*^$|!~]?=)"+L+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+M+"))|)"+L+"*\\]",O=":("+M+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+N+")*)|.*)\\)|)",P=new RegExp(L+"+","g"),Q=new RegExp("^"+L+"+|((?:^|[^\\\\])(?:\\\\.)*)"+L+"+$","g"),R=new RegExp("^"+L+"*,"+L+"*"),S=new RegExp("^"+L+"*([>+~]|"+L+")"+L+"*"),T=new RegExp("="+L+"*([^\\]'\"]*?)"+L+"*\\]","g"),U=new RegExp(O),V=new RegExp("^"+M+"$"),W={ID:new RegExp("^#("+M+")"),CLASS:new RegExp("^\\.("+M+")"),TAG:new RegExp("^("+M+"|[*])"),ATTR:new RegExp("^"+N),PSEUDO:new RegExp("^"+O),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+L+"*(even|odd|(([+-]|)(\\d*)n|)"+L+"*(?:([+-]|)"+L+"*(\\d+)|))"+L+"*\\)|)","i"),bool:new RegExp("^(?:"+K+")$","i"),needsContext:new RegExp("^"+L+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+L+"*((?:-\\d)?\\d*)"+L+"*\\)|)(?=[^-]|$)","i")},X=/^(?:input|select|textarea|button)$/i,Y=/^h\d$/i,Z=/^[^{]+\{\s*\[native \w/,$=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,_=/[+~]/,aa=/'|\\/g,ba=new RegExp("\\\\([\\da-f]{1,6}"+L+"?|("+L+")|.)","ig"),ca=function(a,b,c){var d="0x"+b-65536;return d!==d||c?b:0>d?String.fromCharCode(d+65536):String.fromCharCode(d>>10|55296,1023&d|56320)},da=function(){m()};try{H.apply(E=I.call(v.childNodes),v.childNodes),E[v.childNodes.length].nodeType}catch(ea){H={apply:E.length?function(a,b){G.apply(a,I.call(b))}:function(a,b){var c=a.length,d=0;while(a[c++]=b[d++]);a.length=c-1}}}function fa(a,b,d,e){var f,h,j,k,l,o,r,s,w=b&&b.ownerDocument,x=b?b.nodeType:9;if(d=d||[],"string"!=typeof a||!a||1!==x&&9!==x&&11!==x)return d;if(!e&&((b?b.ownerDocument||b:v)!==n&&m(b),b=b||n,p)){if(11!==x&&(o=$.exec(a)))if(f=o[1]){if(9===x){if(!(j=b.getElementById(f)))return d;if(j.id===f)return d.push(j),d}else if(w&&(j=w.getElementById(f))&&t(b,j)&&j.id===f)return d.push(j),d}else{if(o[2])return H.apply(d,b.getElementsByTagName(a)),d;if((f=o[3])&&c.getElementsByClassName&&b.getElementsByClassName)return H.apply(d,b.getElementsByClassName(f)),d}if(c.qsa&&!A[a+" "]&&(!q||!q.test(a))){if(1!==x)w=b,s=a;else if("object"!==b.nodeName.toLowerCase()){(k=b.getAttribute("id"))?k=k.replace(aa,"\\$&"):b.setAttribute("id",k=u),r=g(a),h=r.length,l=V.test(k)?"#"+k:"[id='"+k+"']";while(h--)r[h]=l+" "+qa(r[h]);s=r.join(","),w=_.test(a)&&oa(b.parentNode)||b}if(s)try{return H.apply(d,w.querySelectorAll(s)),d}catch(y){}finally{k===u&&b.removeAttribute("id")}}}return i(a.replace(Q,"$1"),b,d,e)}function ga(){var a=[];function b(c,e){return a.push(c+" ")>d.cacheLength&&delete b[a.shift()],b[c+" "]=e}return b}function ha(a){return a[u]=!0,a}function ia(a){var b=n.createElement("div");try{return!!a(b)}catch(c){return!1}finally{b.parentNode&&b.parentNode.removeChild(b),b=null}}function ja(a,b){var c=a.split("|"),e=c.length;while(e--)d.attrHandle[c[e]]=b}function ka(a,b){var c=b&&a,d=c&&1===a.nodeType&&1===b.nodeType&&(~b.sourceIndex||C)-(~a.sourceIndex||C);if(d)return d;if(c)while(c=c.nextSibling)if(c===b)return-1;return a?1:-1}function la(a){return function(b){var c=b.nodeName.toLowerCase();return"input"===c&&b.type===a}}function ma(a){return function(b){var c=b.nodeName.toLowerCase();return("input"===c||"button"===c)&&b.type===a}}function na(a){return ha(function(b){return b=+b,ha(function(c,d){var e,f=a([],c.length,b),g=f.length;while(g--)c[e=f[g]]&&(c[e]=!(d[e]=c[e]))})})}function oa(a){return a&&"undefined"!=typeof a.getElementsByTagName&&a}c=fa.support={},f=fa.isXML=function(a){var b=a&&(a.ownerDocument||a).documentElement;return b?"HTML"!==b.nodeName:!1},m=fa.setDocument=function(a){var b,e,g=a?a.ownerDocument||a:v;return g!==n&&9===g.nodeType&&g.documentElement?(n=g,o=n.documentElement,p=!f(n),(e=n.defaultView)&&e.top!==e&&(e.addEventListener?e.addEventListener("unload",da,!1):e.attachEvent&&e.attachEvent("onunload",da)),c.attributes=ia(function(a){return a.className="i",!a.getAttribute("className")}),c.getElementsByTagName=ia(function(a){return a.appendChild(n.createComment("")),!a.getElementsByTagName("*").length}),c.getElementsByClassName=Z.test(n.getElementsByClassName),c.getById=ia(function(a){return o.appendChild(a).id=u,!n.getElementsByName||!n.getElementsByName(u).length}),c.getById?(d.find.ID=function(a,b){if("undefined"!=typeof b.getElementById&&p){var c=b.getElementById(a);return c?[c]:[]}},d.filter.ID=function(a){var b=a.replace(ba,ca);return function(a){return a.getAttribute("id")===b}}):(delete d.find.ID,d.filter.ID=function(a){var b=a.replace(ba,ca);return function(a){var c="undefined"!=typeof a.getAttributeNode&&a.getAttributeNode("id");return c&&c.value===b}}),d.find.TAG=c.getElementsByTagName?function(a,b){return"undefined"!=typeof b.getElementsByTagName?b.getElementsByTagName(a):c.qsa?b.querySelectorAll(a):void 0}:function(a,b){var c,d=[],e=0,f=b.getElementsByTagName(a);if("*"===a){while(c=f[e++])1===c.nodeType&&d.push(c);return d}return f},d.find.CLASS=c.getElementsByClassName&&function(a,b){return"undefined"!=typeof b.getElementsByClassName&&p?b.getElementsByClassName(a):void 0},r=[],q=[],(c.qsa=Z.test(n.querySelectorAll))&&(ia(function(a){o.appendChild(a).innerHTML="<a id='"+u+"'></a><select id='"+u+"-\r\\' msallowcapture=''><option selected=''></option></select>",a.querySelectorAll("[msallowcapture^='']").length&&q.push("[*^$]="+L+"*(?:''|\"\")"),a.querySelectorAll("[selected]").length||q.push("\\["+L+"*(?:value|"+K+")"),a.querySelectorAll("[id~="+u+"-]").length||q.push("~="),a.querySelectorAll(":checked").length||q.push(":checked"),a.querySelectorAll("a#"+u+"+*").length||q.push(".#.+[+~]")}),ia(function(a){var b=n.createElement("input");b.setAttribute("type","hidden"),a.appendChild(b).setAttribute("name","D"),a.querySelectorAll("[name=d]").length&&q.push("name"+L+"*[*^$|!~]?="),a.querySelectorAll(":enabled").length||q.push(":enabled",":disabled"),a.querySelectorAll("*,:x"),q.push(",.*:")})),(c.matchesSelector=Z.test(s=o.matches||o.webkitMatchesSelector||o.mozMatchesSelector||o.oMatchesSelector||o.msMatchesSelector))&&ia(function(a){c.disconnectedMatch=s.call(a,"div"),s.call(a,"[s!='']:x"),r.push("!=",O)}),q=q.length&&new RegExp(q.join("|")),r=r.length&&new RegExp(r.join("|")),b=Z.test(o.compareDocumentPosition),t=b||Z.test(o.contains)?function(a,b){var c=9===a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a===d||!(!d||1!==d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)while(b=b.parentNode)if(b===a)return!0;return!1},B=b?function(a,b){if(a===b)return l=!0,0;var d=!a.compareDocumentPosition-!b.compareDocumentPosition;return d?d:(d=(a.ownerDocument||a)===(b.ownerDocument||b)?a.compareDocumentPosition(b):1,1&d||!c.sortDetached&&b.compareDocumentPosition(a)===d?a===n||a.ownerDocument===v&&t(v,a)?-1:b===n||b.ownerDocument===v&&t(v,b)?1:k?J(k,a)-J(k,b):0:4&d?-1:1)}:function(a,b){if(a===b)return l=!0,0;var c,d=0,e=a.parentNode,f=b.parentNode,g=[a],h=[b];if(!e||!f)return a===n?-1:b===n?1:e?-1:f?1:k?J(k,a)-J(k,b):0;if(e===f)return ka(a,b);c=a;while(c=c.parentNode)g.unshift(c);c=b;while(c=c.parentNode)h.unshift(c);while(g[d]===h[d])d++;return d?ka(g[d],h[d]):g[d]===v?-1:h[d]===v?1:0},n):n},fa.matches=function(a,b){return fa(a,null,null,b)},fa.matchesSelector=function(a,b){if((a.ownerDocument||a)!==n&&m(a),b=b.replace(T,"='$1']"),c.matchesSelector&&p&&!A[b+" "]&&(!r||!r.test(b))&&(!q||!q.test(b)))try{var d=s.call(a,b);if(d||c.disconnectedMatch||a.document&&11!==a.document.nodeType)return d}catch(e){}return fa(b,n,null,[a]).length>0},fa.contains=function(a,b){return(a.ownerDocument||a)!==n&&m(a),t(a,b)},fa.attr=function(a,b){(a.ownerDocument||a)!==n&&m(a);var e=d.attrHandle[b.toLowerCase()],f=e&&D.call(d.attrHandle,b.toLowerCase())?e(a,b,!p):void 0;return void 0!==f?f:c.attributes||!p?a.getAttribute(b):(f=a.getAttributeNode(b))&&f.specified?f.value:null},fa.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)},fa.uniqueSort=function(a){var b,d=[],e=0,f=0;if(l=!c.detectDuplicates,k=!c.sortStable&&a.slice(0),a.sort(B),l){while(b=a[f++])b===a[f]&&(e=d.push(f));while(e--)a.splice(d[e],1)}return k=null,a},e=fa.getText=function(a){var b,c="",d=0,f=a.nodeType;if(f){if(1===f||9===f||11===f){if("string"==typeof a.textContent)return a.textContent;for(a=a.firstChild;a;a=a.nextSibling)c+=e(a)}else if(3===f||4===f)return a.nodeValue}else while(b=a[d++])c+=e(b);return c},d=fa.selectors={cacheLength:50,createPseudo:ha,match:W,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(a){return a[1]=a[1].replace(ba,ca),a[3]=(a[3]||a[4]||a[5]||"").replace(ba,ca),"~="===a[2]&&(a[3]=" "+a[3]+" "),a.slice(0,4)},CHILD:function(a){return a[1]=a[1].toLowerCase(),"nth"===a[1].slice(0,3)?(a[3]||fa.error(a[0]),a[4]=+(a[4]?a[5]+(a[6]||1):2*("even"===a[3]||"odd"===a[3])),a[5]=+(a[7]+a[8]||"odd"===a[3])):a[3]&&fa.error(a[0]),a},PSEUDO:function(a){var b,c=!a[6]&&a[2];return W.CHILD.test(a[0])?null:(a[3]?a[2]=a[4]||a[5]||"":c&&U.test(c)&&(b=g(c,!0))&&(b=c.indexOf(")",c.length-b)-c.length)&&(a[0]=a[0].slice(0,b),a[2]=c.slice(0,b)),a.slice(0,3))}},filter:{TAG:function(a){var b=a.replace(ba,ca).toLowerCase();return"*"===a?function(){return!0}:function(a){return a.nodeName&&a.nodeName.toLowerCase()===b}},CLASS:function(a){var b=y[a+" "];return b||(b=new RegExp("(^|"+L+")"+a+"("+L+"|$)"))&&y(a,function(a){return b.test("string"==typeof a.className&&a.className||"undefined"!=typeof a.getAttribute&&a.getAttribute("class")||"")})},ATTR:function(a,b,c){return function(d){var e=fa.attr(d,a);return null==e?"!="===b:b?(e+="","="===b?e===c:"!="===b?e!==c:"^="===b?c&&0===e.indexOf(c):"*="===b?c&&e.indexOf(c)>-1:"$="===b?c&&e.slice(-c.length)===c:"~="===b?(" "+e.replace(P," ")+" ").indexOf(c)>-1:"|="===b?e===c||e.slice(0,c.length+1)===c+"-":!1):!0}},CHILD:function(a,b,c,d,e){var f="nth"!==a.slice(0,3),g="last"!==a.slice(-4),h="of-type"===b;return 1===d&&0===e?function(a){return!!a.parentNode}:function(b,c,i){var j,k,l,m,n,o,p=f!==g?"nextSibling":"previousSibling",q=b.parentNode,r=h&&b.nodeName.toLowerCase(),s=!i&&!h,t=!1;if(q){if(f){while(p){m=b;while(m=m[p])if(h?m.nodeName.toLowerCase()===r:1===m.nodeType)return!1;o=p="only"===a&&!o&&"nextSibling"}return!0}if(o=[g?q.firstChild:q.lastChild],g&&s){m=q,l=m[u]||(m[u]={}),k=l[m.uniqueID]||(l[m.uniqueID]={}),j=k[a]||[],n=j[0]===w&&j[1],t=n&&j[2],m=n&&q.childNodes[n];while(m=++n&&m&&m[p]||(t=n=0)||o.pop())if(1===m.nodeType&&++t&&m===b){k[a]=[w,n,t];break}}else if(s&&(m=b,l=m[u]||(m[u]={}),k=l[m.uniqueID]||(l[m.uniqueID]={}),j=k[a]||[],n=j[0]===w&&j[1],t=n),t===!1)while(m=++n&&m&&m[p]||(t=n=0)||o.pop())if((h?m.nodeName.toLowerCase()===r:1===m.nodeType)&&++t&&(s&&(l=m[u]||(m[u]={}),k=l[m.uniqueID]||(l[m.uniqueID]={}),k[a]=[w,t]),m===b))break;return t-=e,t===d||t%d===0&&t/d>=0}}},PSEUDO:function(a,b){var c,e=d.pseudos[a]||d.setFilters[a.toLowerCase()]||fa.error("unsupported pseudo: "+a);return e[u]?e(b):e.length>1?(c=[a,a,"",b],d.setFilters.hasOwnProperty(a.toLowerCase())?ha(function(a,c){var d,f=e(a,b),g=f.length;while(g--)d=J(a,f[g]),a[d]=!(c[d]=f[g])}):function(a){return e(a,0,c)}):e}},pseudos:{not:ha(function(a){var b=[],c=[],d=h(a.replace(Q,"$1"));return d[u]?ha(function(a,b,c,e){var f,g=d(a,null,e,[]),h=a.length;while(h--)(f=g[h])&&(a[h]=!(b[h]=f))}):function(a,e,f){return b[0]=a,d(b,null,f,c),b[0]=null,!c.pop()}}),has:ha(function(a){return function(b){return fa(a,b).length>0}}),contains:ha(function(a){return a=a.replace(ba,ca),function(b){return(b.textContent||b.innerText||e(b)).indexOf(a)>-1}}),lang:ha(function(a){return V.test(a||"")||fa.error("unsupported lang: "+a),a=a.replace(ba,ca).toLowerCase(),function(b){var c;do if(c=p?b.lang:b.getAttribute("xml:lang")||b.getAttribute("lang"))return c=c.toLowerCase(),c===a||0===c.indexOf(a+"-");while((b=b.parentNode)&&1===b.nodeType);return!1}}),target:function(b){var c=a.location&&a.location.hash;return c&&c.slice(1)===b.id},root:function(a){return a===o},focus:function(a){return a===n.activeElement&&(!n.hasFocus||n.hasFocus())&&!!(a.type||a.href||~a.tabIndex)},enabled:function(a){return a.disabled===!1},disabled:function(a){return a.disabled===!0},checked:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&!!a.checked||"option"===b&&!!a.selected},selected:function(a){return a.parentNode&&a.parentNode.selectedIndex,a.selected===!0},empty:function(a){for(a=a.firstChild;a;a=a.nextSibling)if(a.nodeType<6)return!1;return!0},parent:function(a){return!d.pseudos.empty(a)},header:function(a){return Y.test(a.nodeName)},input:function(a){return X.test(a.nodeName)},button:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&"button"===a.type||"button"===b},text:function(a){var b;return"input"===a.nodeName.toLowerCase()&&"text"===a.type&&(null==(b=a.getAttribute("type"))||"text"===b.toLowerCase())},first:na(function(){return[0]}),last:na(function(a,b){return[b-1]}),eq:na(function(a,b,c){return[0>c?c+b:c]}),even:na(function(a,b){for(var c=0;b>c;c+=2)a.push(c);return a}),odd:na(function(a,b){for(var c=1;b>c;c+=2)a.push(c);return a}),lt:na(function(a,b,c){for(var d=0>c?c+b:c;--d>=0;)a.push(d);return a}),gt:na(function(a,b,c){for(var d=0>c?c+b:c;++d<b;)a.push(d);return a})}},d.pseudos.nth=d.pseudos.eq;for(b in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})d.pseudos[b]=la(b);for(b in{submit:!0,reset:!0})d.pseudos[b]=ma(b);function pa(){}pa.prototype=d.filters=d.pseudos,d.setFilters=new pa,g=fa.tokenize=function(a,b){var c,e,f,g,h,i,j,k=z[a+" "];if(k)return b?0:k.slice(0);h=a,i=[],j=d.preFilter;while(h){(!c||(e=R.exec(h)))&&(e&&(h=h.slice(e[0].length)||h),i.push(f=[])),c=!1,(e=S.exec(h))&&(c=e.shift(),f.push({value:c,type:e[0].replace(Q," ")}),h=h.slice(c.length));for(g in d.filter)!(e=W[g].exec(h))||j[g]&&!(e=j[g](e))||(c=e.shift(),f.push({value:c,type:g,matches:e}),h=h.slice(c.length));if(!c)break}return b?h.length:h?fa.error(a):z(a,i).slice(0)};function qa(a){for(var b=0,c=a.length,d="";c>b;b++)d+=a[b].value;return d}function ra(a,b,c){var d=b.dir,e=c&&"parentNode"===d,f=x++;return b.first?function(b,c,f){while(b=b[d])if(1===b.nodeType||e)return a(b,c,f)}:function(b,c,g){var h,i,j,k=[w,f];if(g){while(b=b[d])if((1===b.nodeType||e)&&a(b,c,g))return!0}else while(b=b[d])if(1===b.nodeType||e){if(j=b[u]||(b[u]={}),i=j[b.uniqueID]||(j[b.uniqueID]={}),(h=i[d])&&h[0]===w&&h[1]===f)return k[2]=h[2];if(i[d]=k,k[2]=a(b,c,g))return!0}}}function sa(a){return a.length>1?function(b,c,d){var e=a.length;while(e--)if(!a[e](b,c,d))return!1;return!0}:a[0]}function ta(a,b,c){for(var d=0,e=b.length;e>d;d++)fa(a,b[d],c);return c}function ua(a,b,c,d,e){for(var f,g=[],h=0,i=a.length,j=null!=b;i>h;h++)(f=a[h])&&(!c||c(f,d,e))&&(g.push(f),j&&b.push(h));return g}function va(a,b,c,d,e,f){return d&&!d[u]&&(d=va(d)),e&&!e[u]&&(e=va(e,f)),ha(function(f,g,h,i){var j,k,l,m=[],n=[],o=g.length,p=f||ta(b||"*",h.nodeType?[h]:h,[]),q=!a||!f&&b?p:ua(p,m,a,h,i),r=c?e||(f?a:o||d)?[]:g:q;if(c&&c(q,r,h,i),d){j=ua(r,n),d(j,[],h,i),k=j.length;while(k--)(l=j[k])&&(r[n[k]]=!(q[n[k]]=l))}if(f){if(e||a){if(e){j=[],k=r.length;while(k--)(l=r[k])&&j.push(q[k]=l);e(null,r=[],j,i)}k=r.length;while(k--)(l=r[k])&&(j=e?J(f,l):m[k])>-1&&(f[j]=!(g[j]=l))}}else r=ua(r===g?r.splice(o,r.length):r),e?e(null,g,r,i):H.apply(g,r)})}function wa(a){for(var b,c,e,f=a.length,g=d.relative[a[0].type],h=g||d.relative[" "],i=g?1:0,k=ra(function(a){return a===b},h,!0),l=ra(function(a){return J(b,a)>-1},h,!0),m=[function(a,c,d){var e=!g&&(d||c!==j)||((b=c).nodeType?k(a,c,d):l(a,c,d));return b=null,e}];f>i;i++)if(c=d.relative[a[i].type])m=[ra(sa(m),c)];else{if(c=d.filter[a[i].type].apply(null,a[i].matches),c[u]){for(e=++i;f>e;e++)if(d.relative[a[e].type])break;return va(i>1&&sa(m),i>1&&qa(a.slice(0,i-1).concat({value:" "===a[i-2].type?"*":""})).replace(Q,"$1"),c,e>i&&wa(a.slice(i,e)),f>e&&wa(a=a.slice(e)),f>e&&qa(a))}m.push(c)}return sa(m)}function xa(a,b){var c=b.length>0,e=a.length>0,f=function(f,g,h,i,k){var l,o,q,r=0,s="0",t=f&&[],u=[],v=j,x=f||e&&d.find.TAG("*",k),y=w+=null==v?1:Math.random()||.1,z=x.length;for(k&&(j=g===n||g||k);s!==z&&null!=(l=x[s]);s++){if(e&&l){o=0,g||l.ownerDocument===n||(m(l),h=!p);while(q=a[o++])if(q(l,g||n,h)){i.push(l);break}k&&(w=y)}c&&((l=!q&&l)&&r--,f&&t.push(l))}if(r+=s,c&&s!==r){o=0;while(q=b[o++])q(t,u,g,h);if(f){if(r>0)while(s--)t[s]||u[s]||(u[s]=F.call(i));u=ua(u)}H.apply(i,u),k&&!f&&u.length>0&&r+b.length>1&&fa.uniqueSort(i)}return k&&(w=y,j=v),t};return c?ha(f):f}return h=fa.compile=function(a,b){var c,d=[],e=[],f=A[a+" "];if(!f){b||(b=g(a)),c=b.length;while(c--)f=wa(b[c]),f[u]?d.push(f):e.push(f);f=A(a,xa(e,d)),f.selector=a}return f},i=fa.select=function(a,b,e,f){var i,j,k,l,m,n="function"==typeof a&&a,o=!f&&g(a=n.selector||a);if(e=e||[],1===o.length){if(j=o[0]=o[0].slice(0),j.length>2&&"ID"===(k=j[0]).type&&c.getById&&9===b.nodeType&&p&&d.relative[j[1].type]){if(b=(d.find.ID(k.matches[0].replace(ba,ca),b)||[])[0],!b)return e;n&&(b=b.parentNode),a=a.slice(j.shift().value.length)}i=W.needsContext.test(a)?0:j.length;while(i--){if(k=j[i],d.relative[l=k.type])break;if((m=d.find[l])&&(f=m(k.matches[0].replace(ba,ca),_.test(j[0].type)&&oa(b.parentNode)||b))){if(j.splice(i,1),a=f.length&&qa(j),!a)return H.apply(e,f),e;break}}}return(n||h(a,o))(f,b,!p,e,!b||_.test(a)&&oa(b.parentNode)||b),e},c.sortStable=u.split("").sort(B).join("")===u,c.detectDuplicates=!!l,m(),c.sortDetached=ia(function(a){return 1&a.compareDocumentPosition(n.createElement("div"))}),ia(function(a){return a.innerHTML="<a href='#'></a>","#"===a.firstChild.getAttribute("href")})||ja("type|href|height|width",function(a,b,c){return c?void 0:a.getAttribute(b,"type"===b.toLowerCase()?1:2)}),c.attributes&&ia(function(a){return a.innerHTML="<input/>",a.firstChild.setAttribute("value",""),""===a.firstChild.getAttribute("value")})||ja("value",function(a,b,c){return c||"input"!==a.nodeName.toLowerCase()?void 0:a.defaultValue}),ia(function(a){return null==a.getAttribute("disabled")})||ja(K,function(a,b,c){var d;return c?void 0:a[b]===!0?b.toLowerCase():(d=a.getAttributeNode(b))&&d.specified?d.value:null}),fa}(a);n.find=t,n.expr=t.selectors,n.expr[":"]=n.expr.pseudos,n.uniqueSort=n.unique=t.uniqueSort,n.text=t.getText,n.isXMLDoc=t.isXML,n.contains=t.contains;var u=function(a,b,c){var d=[],e=void 0!==c;while((a=a[b])&&9!==a.nodeType)if(1===a.nodeType){if(e&&n(a).is(c))break;d.push(a)}return d},v=function(a,b){for(var c=[];a;a=a.nextSibling)1===a.nodeType&&a!==b&&c.push(a);return c},w=n.expr.match.needsContext,x=/^<([\w-]+)\s*\/?>(?:<\/\1>|)$/,y=/^.[^:#\[\.,]*$/;function z(a,b,c){if(n.isFunction(b))return n.grep(a,function(a,d){return!!b.call(a,d,a)!==c});if(b.nodeType)return n.grep(a,function(a){return a===b!==c});if("string"==typeof b){if(y.test(b))return n.filter(b,a,c);b=n.filter(b,a)}return n.grep(a,function(a){return h.call(b,a)>-1!==c})}n.filter=function(a,b,c){var d=b[0];return c&&(a=":not("+a+")"),1===b.length&&1===d.nodeType?n.find.matchesSelector(d,a)?[d]:[]:n.find.matches(a,n.grep(b,function(a){return 1===a.nodeType}))},n.fn.extend({find:function(a){var b,c=this.length,d=[],e=this;if("string"!=typeof a)return this.pushStack(n(a).filter(function(){for(b=0;c>b;b++)if(n.contains(e[b],this))return!0}));for(b=0;c>b;b++)n.find(a,e[b],d);return d=this.pushStack(c>1?n.unique(d):d),d.selector=this.selector?this.selector+" "+a:a,d},filter:function(a){return this.pushStack(z(this,a||[],!1))},not:function(a){return this.pushStack(z(this,a||[],!0))},is:function(a){return!!z(this,"string"==typeof a&&w.test(a)?n(a):a||[],!1).length}});var A,B=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,C=n.fn.init=function(a,b,c){var e,f;if(!a)return this;if(c=c||A,"string"==typeof a){if(e="<"===a[0]&&">"===a[a.length-1]&&a.length>=3?[null,a,null]:B.exec(a),!e||!e[1]&&b)return!b||b.jquery?(b||c).find(a):this.constructor(b).find(a);if(e[1]){if(b=b instanceof n?b[0]:b,n.merge(this,n.parseHTML(e[1],b&&b.nodeType?b.ownerDocument||b:d,!0)),x.test(e[1])&&n.isPlainObject(b))for(e in b)n.isFunction(this[e])?this[e](b[e]):this.attr(e,b[e]);return this}return f=d.getElementById(e[2]),f&&f.parentNode&&(this.length=1,this[0]=f),this.context=d,this.selector=a,this}return a.nodeType?(this.context=this[0]=a,this.length=1,this):n.isFunction(a)?void 0!==c.ready?c.ready(a):a(n):(void 0!==a.selector&&(this.selector=a.selector,this.context=a.context),n.makeArray(a,this))};C.prototype=n.fn,A=n(d);var D=/^(?:parents|prev(?:Until|All))/,E={children:!0,contents:!0,next:!0,prev:!0};n.fn.extend({has:function(a){var b=n(a,this),c=b.length;return this.filter(function(){for(var a=0;c>a;a++)if(n.contains(this,b[a]))return!0})},closest:function(a,b){for(var c,d=0,e=this.length,f=[],g=w.test(a)||"string"!=typeof a?n(a,b||this.context):0;e>d;d++)for(c=this[d];c&&c!==b;c=c.parentNode)if(c.nodeType<11&&(g?g.index(c)>-1:1===c.nodeType&&n.find.matchesSelector(c,a))){f.push(c);break}return this.pushStack(f.length>1?n.uniqueSort(f):f)},index:function(a){return a?"string"==typeof a?h.call(n(a),this[0]):h.call(this,a.jquery?a[0]:a):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(a,b){return this.pushStack(n.uniqueSort(n.merge(this.get(),n(a,b))))},addBack:function(a){return this.add(null==a?this.prevObject:this.prevObject.filter(a))}});function F(a,b){while((a=a[b])&&1!==a.nodeType);return a}n.each({parent:function(a){var b=a.parentNode;return b&&11!==b.nodeType?b:null},parents:function(a){return u(a,"parentNode")},parentsUntil:function(a,b,c){return u(a,"parentNode",c)},next:function(a){return F(a,"nextSibling")},prev:function(a){return F(a,"previousSibling")},nextAll:function(a){return u(a,"nextSibling")},prevAll:function(a){return u(a,"previousSibling")},nextUntil:function(a,b,c){return u(a,"nextSibling",c)},prevUntil:function(a,b,c){return u(a,"previousSibling",c)},siblings:function(a){return v((a.parentNode||{}).firstChild,a)},children:function(a){return v(a.firstChild)},contents:function(a){return a.contentDocument||n.merge([],a.childNodes)}},function(a,b){n.fn[a]=function(c,d){var e=n.map(this,b,c);return"Until"!==a.slice(-5)&&(d=c),d&&"string"==typeof d&&(e=n.filter(d,e)),this.length>1&&(E[a]||n.uniqueSort(e),D.test(a)&&e.reverse()),this.pushStack(e)}});var G=/\S+/g;function H(a){var b={};return n.each(a.match(G)||[],function(a,c){b[c]=!0}),b}n.Callbacks=function(a){a="string"==typeof a?H(a):n.extend({},a);var b,c,d,e,f=[],g=[],h=-1,i=function(){for(e=a.once,d=b=!0;g.length;h=-1){c=g.shift();while(++h<f.length)f[h].apply(c[0],c[1])===!1&&a.stopOnFalse&&(h=f.length,c=!1)}a.memory||(c=!1),b=!1,e&&(f=c?[]:"")},j={add:function(){return f&&(c&&!b&&(h=f.length-1,g.push(c)),function d(b){n.each(b,function(b,c){n.isFunction(c)?a.unique&&j.has(c)||f.push(c):c&&c.length&&"string"!==n.type(c)&&d(c)})}(arguments),c&&!b&&i()),this},remove:function(){return n.each(arguments,function(a,b){var c;while((c=n.inArray(b,f,c))>-1)f.splice(c,1),h>=c&&h--}),this},has:function(a){return a?n.inArray(a,f)>-1:f.length>0},empty:function(){return f&&(f=[]),this},disable:function(){return e=g=[],f=c="",this},disabled:function(){return!f},lock:function(){return e=g=[],c||(f=c=""),this},locked:function(){return!!e},fireWith:function(a,c){return e||(c=c||[],c=[a,c.slice?c.slice():c],g.push(c),b||i()),this},fire:function(){return j.fireWith(this,arguments),this},fired:function(){return!!d}};return j},n.extend({Deferred:function(a){var b=[["resolve","done",n.Callbacks("once memory"),"resolved"],["reject","fail",n.Callbacks("once memory"),"rejected"],["notify","progress",n.Callbacks("memory")]],c="pending",d={state:function(){return c},always:function(){return e.done(arguments).fail(arguments),this},then:function(){var a=arguments;return n.Deferred(function(c){n.each(b,function(b,f){var g=n.isFunction(a[b])&&a[b];e[f[1]](function(){var a=g&&g.apply(this,arguments);a&&n.isFunction(a.promise)?a.promise().progress(c.notify).done(c.resolve).fail(c.reject):c[f[0]+"With"](this===d?c.promise():this,g?[a]:arguments)})}),a=null}).promise()},promise:function(a){return null!=a?n.extend(a,d):d}},e={};return d.pipe=d.then,n.each(b,function(a,f){var g=f[2],h=f[3];d[f[1]]=g.add,h&&g.add(function(){c=h},b[1^a][2].disable,b[2][2].lock),e[f[0]]=function(){return e[f[0]+"With"](this===e?d:this,arguments),this},e[f[0]+"With"]=g.fireWith}),d.promise(e),a&&a.call(e,e),e},when:function(a){var b=0,c=e.call(arguments),d=c.length,f=1!==d||a&&n.isFunction(a.promise)?d:0,g=1===f?a:n.Deferred(),h=function(a,b,c){return function(d){b[a]=this,c[a]=arguments.length>1?e.call(arguments):d,c===i?g.notifyWith(b,c):--f||g.resolveWith(b,c)}},i,j,k;if(d>1)for(i=new Array(d),j=new Array(d),k=new Array(d);d>b;b++)c[b]&&n.isFunction(c[b].promise)?c[b].promise().progress(h(b,j,i)).done(h(b,k,c)).fail(g.reject):--f;return f||g.resolveWith(k,c),g.promise()}});var I;n.fn.ready=function(a){return n.ready.promise().done(a),this},n.extend({isReady:!1,readyWait:1,holdReady:function(a){a?n.readyWait++:n.ready(!0)},ready:function(a){(a===!0?--n.readyWait:n.isReady)||(n.isReady=!0,a!==!0&&--n.readyWait>0||(I.resolveWith(d,[n]),n.fn.triggerHandler&&(n(d).triggerHandler("ready"),n(d).off("ready"))))}});function J(){d.removeEventListener("DOMContentLoaded",J),a.removeEventListener("load",J),n.ready()}n.ready.promise=function(b){return I||(I=n.Deferred(),"complete"===d.readyState||"loading"!==d.readyState&&!d.documentElement.doScroll?a.setTimeout(n.ready):(d.addEventListener("DOMContentLoaded",J),a.addEventListener("load",J))),I.promise(b)},n.ready.promise();var K=function(a,b,c,d,e,f,g){var h=0,i=a.length,j=null==c;if("object"===n.type(c)){e=!0;for(h in c)K(a,b,h,c[h],!0,f,g)}else if(void 0!==d&&(e=!0,n.isFunction(d)||(g=!0),j&&(g?(b.call(a,d),b=null):(j=b,b=function(a,b,c){return j.call(n(a),c)})),b))for(;i>h;h++)b(a[h],c,g?d:d.call(a[h],h,b(a[h],c)));return e?a:j?b.call(a):i?b(a[0],c):f},L=function(a){return 1===a.nodeType||9===a.nodeType||!+a.nodeType};function M(){this.expando=n.expando+M.uid++}M.uid=1,M.prototype={register:function(a,b){var c=b||{};return a.nodeType?a[this.expando]=c:Object.defineProperty(a,this.expando,{value:c,writable:!0,configurable:!0}),a[this.expando]},cache:function(a){if(!L(a))return{};var b=a[this.expando];return b||(b={},L(a)&&(a.nodeType?a[this.expando]=b:Object.defineProperty(a,this.expando,{value:b,configurable:!0}))),b},set:function(a,b,c){var d,e=this.cache(a);if("string"==typeof b)e[b]=c;else for(d in b)e[d]=b[d];return e},get:function(a,b){return void 0===b?this.cache(a):a[this.expando]&&a[this.expando][b]},access:function(a,b,c){var d;return void 0===b||b&&"string"==typeof b&&void 0===c?(d=this.get(a,b),void 0!==d?d:this.get(a,n.camelCase(b))):(this.set(a,b,c),void 0!==c?c:b)},remove:function(a,b){var c,d,e,f=a[this.expando];if(void 0!==f){if(void 0===b)this.register(a);else{n.isArray(b)?d=b.concat(b.map(n.camelCase)):(e=n.camelCase(b),b in f?d=[b,e]:(d=e,d=d in f?[d]:d.match(G)||[])),c=d.length;while(c--)delete f[d[c]]}(void 0===b||n.isEmptyObject(f))&&(a.nodeType?a[this.expando]=void 0:delete a[this.expando])}},hasData:function(a){var b=a[this.expando];return void 0!==b&&!n.isEmptyObject(b)}};var N=new M,O=new M,P=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,Q=/[A-Z]/g;function R(a,b,c){var d;if(void 0===c&&1===a.nodeType)if(d="data-"+b.replace(Q,"-$&").toLowerCase(),c=a.getAttribute(d),"string"==typeof c){try{c="true"===c?!0:"false"===c?!1:"null"===c?null:+c+""===c?+c:P.test(c)?n.parseJSON(c):c}catch(e){}O.set(a,b,c);
}else c=void 0;return c}n.extend({hasData:function(a){return O.hasData(a)||N.hasData(a)},data:function(a,b,c){return O.access(a,b,c)},removeData:function(a,b){O.remove(a,b)},_data:function(a,b,c){return N.access(a,b,c)},_removeData:function(a,b){N.remove(a,b)}}),n.fn.extend({data:function(a,b){var c,d,e,f=this[0],g=f&&f.attributes;if(void 0===a){if(this.length&&(e=O.get(f),1===f.nodeType&&!N.get(f,"hasDataAttrs"))){c=g.length;while(c--)g[c]&&(d=g[c].name,0===d.indexOf("data-")&&(d=n.camelCase(d.slice(5)),R(f,d,e[d])));N.set(f,"hasDataAttrs",!0)}return e}return"object"==typeof a?this.each(function(){O.set(this,a)}):K(this,function(b){var c,d;if(f&&void 0===b){if(c=O.get(f,a)||O.get(f,a.replace(Q,"-$&").toLowerCase()),void 0!==c)return c;if(d=n.camelCase(a),c=O.get(f,d),void 0!==c)return c;if(c=R(f,d,void 0),void 0!==c)return c}else d=n.camelCase(a),this.each(function(){var c=O.get(this,d);O.set(this,d,b),a.indexOf("-")>-1&&void 0!==c&&O.set(this,a,b)})},null,b,arguments.length>1,null,!0)},removeData:function(a){return this.each(function(){O.remove(this,a)})}}),n.extend({queue:function(a,b,c){var d;return a?(b=(b||"fx")+"queue",d=N.get(a,b),c&&(!d||n.isArray(c)?d=N.access(a,b,n.makeArray(c)):d.push(c)),d||[]):void 0},dequeue:function(a,b){b=b||"fx";var c=n.queue(a,b),d=c.length,e=c.shift(),f=n._queueHooks(a,b),g=function(){n.dequeue(a,b)};"inprogress"===e&&(e=c.shift(),d--),e&&("fx"===b&&c.unshift("inprogress"),delete f.stop,e.call(a,g,f)),!d&&f&&f.empty.fire()},_queueHooks:function(a,b){var c=b+"queueHooks";return N.get(a,c)||N.access(a,c,{empty:n.Callbacks("once memory").add(function(){N.remove(a,[b+"queue",c])})})}}),n.fn.extend({queue:function(a,b){var c=2;return"string"!=typeof a&&(b=a,a="fx",c--),arguments.length<c?n.queue(this[0],a):void 0===b?this:this.each(function(){var c=n.queue(this,a,b);n._queueHooks(this,a),"fx"===a&&"inprogress"!==c[0]&&n.dequeue(this,a)})},dequeue:function(a){return this.each(function(){n.dequeue(this,a)})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,b){var c,d=1,e=n.Deferred(),f=this,g=this.length,h=function(){--d||e.resolveWith(f,[f])};"string"!=typeof a&&(b=a,a=void 0),a=a||"fx";while(g--)c=N.get(f[g],a+"queueHooks"),c&&c.empty&&(d++,c.empty.add(h));return h(),e.promise(b)}});var S=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,T=new RegExp("^(?:([+-])=|)("+S+")([a-z%]*)$","i"),U=["Top","Right","Bottom","Left"],V=function(a,b){return a=b||a,"none"===n.css(a,"display")||!n.contains(a.ownerDocument,a)};function W(a,b,c,d){var e,f=1,g=20,h=d?function(){return d.cur()}:function(){return n.css(a,b,"")},i=h(),j=c&&c[3]||(n.cssNumber[b]?"":"px"),k=(n.cssNumber[b]||"px"!==j&&+i)&&T.exec(n.css(a,b));if(k&&k[3]!==j){j=j||k[3],c=c||[],k=+i||1;do f=f||".5",k/=f,n.style(a,b,k+j);while(f!==(f=h()/i)&&1!==f&&--g)}return c&&(k=+k||+i||0,e=c[1]?k+(c[1]+1)*c[2]:+c[2],d&&(d.unit=j,d.start=k,d.end=e)),e}var X=/^(?:checkbox|radio)$/i,Y=/<([\w:-]+)/,Z=/^$|\/(?:java|ecma)script/i,$={option:[1,"<select multiple='multiple'>","</select>"],thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};$.optgroup=$.option,$.tbody=$.tfoot=$.colgroup=$.caption=$.thead,$.th=$.td;function _(a,b){var c="undefined"!=typeof a.getElementsByTagName?a.getElementsByTagName(b||"*"):"undefined"!=typeof a.querySelectorAll?a.querySelectorAll(b||"*"):[];return void 0===b||b&&n.nodeName(a,b)?n.merge([a],c):c}function aa(a,b){for(var c=0,d=a.length;d>c;c++)N.set(a[c],"globalEval",!b||N.get(b[c],"globalEval"))}var ba=/<|&#?\w+;/;function ca(a,b,c,d,e){for(var f,g,h,i,j,k,l=b.createDocumentFragment(),m=[],o=0,p=a.length;p>o;o++)if(f=a[o],f||0===f)if("object"===n.type(f))n.merge(m,f.nodeType?[f]:f);else if(ba.test(f)){g=g||l.appendChild(b.createElement("div")),h=(Y.exec(f)||["",""])[1].toLowerCase(),i=$[h]||$._default,g.innerHTML=i[1]+n.htmlPrefilter(f)+i[2],k=i[0];while(k--)g=g.lastChild;n.merge(m,g.childNodes),g=l.firstChild,g.textContent=""}else m.push(b.createTextNode(f));l.textContent="",o=0;while(f=m[o++])if(d&&n.inArray(f,d)>-1)e&&e.push(f);else if(j=n.contains(f.ownerDocument,f),g=_(l.appendChild(f),"script"),j&&aa(g),c){k=0;while(f=g[k++])Z.test(f.type||"")&&c.push(f)}return l}!function(){var a=d.createDocumentFragment(),b=a.appendChild(d.createElement("div")),c=d.createElement("input");c.setAttribute("type","radio"),c.setAttribute("checked","checked"),c.setAttribute("name","t"),b.appendChild(c),l.checkClone=b.cloneNode(!0).cloneNode(!0).lastChild.checked,b.innerHTML="<textarea>x</textarea>",l.noCloneChecked=!!b.cloneNode(!0).lastChild.defaultValue}();var da=/^key/,ea=/^(?:mouse|pointer|contextmenu|drag|drop)|click/,fa=/^([^.]*)(?:\.(.+)|)/;function ga(){return!0}function ha(){return!1}function ia(){try{return d.activeElement}catch(a){}}function ja(a,b,c,d,e,f){var g,h;if("object"==typeof b){"string"!=typeof c&&(d=d||c,c=void 0);for(h in b)ja(a,h,c,d,b[h],f);return a}if(null==d&&null==e?(e=c,d=c=void 0):null==e&&("string"==typeof c?(e=d,d=void 0):(e=d,d=c,c=void 0)),e===!1)e=ha;else if(!e)return a;return 1===f&&(g=e,e=function(a){return n().off(a),g.apply(this,arguments)},e.guid=g.guid||(g.guid=n.guid++)),a.each(function(){n.event.add(this,b,e,d,c)})}n.event={global:{},add:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=N.get(a);if(r){c.handler&&(f=c,c=f.handler,e=f.selector),c.guid||(c.guid=n.guid++),(i=r.events)||(i=r.events={}),(g=r.handle)||(g=r.handle=function(b){return"undefined"!=typeof n&&n.event.triggered!==b.type?n.event.dispatch.apply(a,arguments):void 0}),b=(b||"").match(G)||[""],j=b.length;while(j--)h=fa.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o&&(l=n.event.special[o]||{},o=(e?l.delegateType:l.bindType)||o,l=n.event.special[o]||{},k=n.extend({type:o,origType:q,data:d,handler:c,guid:c.guid,selector:e,needsContext:e&&n.expr.match.needsContext.test(e),namespace:p.join(".")},f),(m=i[o])||(m=i[o]=[],m.delegateCount=0,l.setup&&l.setup.call(a,d,p,g)!==!1||a.addEventListener&&a.addEventListener(o,g)),l.add&&(l.add.call(a,k),k.handler.guid||(k.handler.guid=c.guid)),e?m.splice(m.delegateCount++,0,k):m.push(k),n.event.global[o]=!0)}},remove:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=N.hasData(a)&&N.get(a);if(r&&(i=r.events)){b=(b||"").match(G)||[""],j=b.length;while(j--)if(h=fa.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o){l=n.event.special[o]||{},o=(d?l.delegateType:l.bindType)||o,m=i[o]||[],h=h[2]&&new RegExp("(^|\\.)"+p.join("\\.(?:.*\\.|)")+"(\\.|$)"),g=f=m.length;while(f--)k=m[f],!e&&q!==k.origType||c&&c.guid!==k.guid||h&&!h.test(k.namespace)||d&&d!==k.selector&&("**"!==d||!k.selector)||(m.splice(f,1),k.selector&&m.delegateCount--,l.remove&&l.remove.call(a,k));g&&!m.length&&(l.teardown&&l.teardown.call(a,p,r.handle)!==!1||n.removeEvent(a,o,r.handle),delete i[o])}else for(o in i)n.event.remove(a,o+b[j],c,d,!0);n.isEmptyObject(i)&&N.remove(a,"handle events")}},dispatch:function(a){a=n.event.fix(a);var b,c,d,f,g,h=[],i=e.call(arguments),j=(N.get(this,"events")||{})[a.type]||[],k=n.event.special[a.type]||{};if(i[0]=a,a.delegateTarget=this,!k.preDispatch||k.preDispatch.call(this,a)!==!1){h=n.event.handlers.call(this,a,j),b=0;while((f=h[b++])&&!a.isPropagationStopped()){a.currentTarget=f.elem,c=0;while((g=f.handlers[c++])&&!a.isImmediatePropagationStopped())(!a.rnamespace||a.rnamespace.test(g.namespace))&&(a.handleObj=g,a.data=g.data,d=((n.event.special[g.origType]||{}).handle||g.handler).apply(f.elem,i),void 0!==d&&(a.result=d)===!1&&(a.preventDefault(),a.stopPropagation()))}return k.postDispatch&&k.postDispatch.call(this,a),a.result}},handlers:function(a,b){var c,d,e,f,g=[],h=b.delegateCount,i=a.target;if(h&&i.nodeType&&("click"!==a.type||isNaN(a.button)||a.button<1))for(;i!==this;i=i.parentNode||this)if(1===i.nodeType&&(i.disabled!==!0||"click"!==a.type)){for(d=[],c=0;h>c;c++)f=b[c],e=f.selector+" ",void 0===d[e]&&(d[e]=f.needsContext?n(e,this).index(i)>-1:n.find(e,this,null,[i]).length),d[e]&&d.push(f);d.length&&g.push({elem:i,handlers:d})}return h<b.length&&g.push({elem:this,handlers:b.slice(h)}),g},props:"altKey bubbles cancelable ctrlKey currentTarget detail eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(a,b){return null==a.which&&(a.which=null!=b.charCode?b.charCode:b.keyCode),a}},mouseHooks:{props:"button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(a,b){var c,e,f,g=b.button;return null==a.pageX&&null!=b.clientX&&(c=a.target.ownerDocument||d,e=c.documentElement,f=c.body,a.pageX=b.clientX+(e&&e.scrollLeft||f&&f.scrollLeft||0)-(e&&e.clientLeft||f&&f.clientLeft||0),a.pageY=b.clientY+(e&&e.scrollTop||f&&f.scrollTop||0)-(e&&e.clientTop||f&&f.clientTop||0)),a.which||void 0===g||(a.which=1&g?1:2&g?3:4&g?2:0),a}},fix:function(a){if(a[n.expando])return a;var b,c,e,f=a.type,g=a,h=this.fixHooks[f];h||(this.fixHooks[f]=h=ea.test(f)?this.mouseHooks:da.test(f)?this.keyHooks:{}),e=h.props?this.props.concat(h.props):this.props,a=new n.Event(g),b=e.length;while(b--)c=e[b],a[c]=g[c];return a.target||(a.target=d),3===a.target.nodeType&&(a.target=a.target.parentNode),h.filter?h.filter(a,g):a},special:{load:{noBubble:!0},focus:{trigger:function(){return this!==ia()&&this.focus?(this.focus(),!1):void 0},delegateType:"focusin"},blur:{trigger:function(){return this===ia()&&this.blur?(this.blur(),!1):void 0},delegateType:"focusout"},click:{trigger:function(){return"checkbox"===this.type&&this.click&&n.nodeName(this,"input")?(this.click(),!1):void 0},_default:function(a){return n.nodeName(a.target,"a")}},beforeunload:{postDispatch:function(a){void 0!==a.result&&a.originalEvent&&(a.originalEvent.returnValue=a.result)}}}},n.removeEvent=function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c)},n.Event=function(a,b){return this instanceof n.Event?(a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||void 0===a.defaultPrevented&&a.returnValue===!1?ga:ha):this.type=a,b&&n.extend(this,b),this.timeStamp=a&&a.timeStamp||n.now(),void(this[n.expando]=!0)):new n.Event(a,b)},n.Event.prototype={constructor:n.Event,isDefaultPrevented:ha,isPropagationStopped:ha,isImmediatePropagationStopped:ha,preventDefault:function(){var a=this.originalEvent;this.isDefaultPrevented=ga,a&&a.preventDefault()},stopPropagation:function(){var a=this.originalEvent;this.isPropagationStopped=ga,a&&a.stopPropagation()},stopImmediatePropagation:function(){var a=this.originalEvent;this.isImmediatePropagationStopped=ga,a&&a.stopImmediatePropagation(),this.stopPropagation()}},n.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(a,b){n.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c,d=this,e=a.relatedTarget,f=a.handleObj;return(!e||e!==d&&!n.contains(d,e))&&(a.type=f.origType,c=f.handler.apply(this,arguments),a.type=b),c}}}),n.fn.extend({on:function(a,b,c,d){return ja(this,a,b,c,d)},one:function(a,b,c,d){return ja(this,a,b,c,d,1)},off:function(a,b,c){var d,e;if(a&&a.preventDefault&&a.handleObj)return d=a.handleObj,n(a.delegateTarget).off(d.namespace?d.origType+"."+d.namespace:d.origType,d.selector,d.handler),this;if("object"==typeof a){for(e in a)this.off(e,b,a[e]);return this}return(b===!1||"function"==typeof b)&&(c=b,b=void 0),c===!1&&(c=ha),this.each(function(){n.event.remove(this,a,c,b)})}});var ka=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:-]+)[^>]*)\/>/gi,la=/<script|<style|<link/i,ma=/checked\s*(?:[^=]|=\s*.checked.)/i,na=/^true\/(.*)/,oa=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;function pa(a,b){return n.nodeName(a,"table")&&n.nodeName(11!==b.nodeType?b:b.firstChild,"tr")?a.getElementsByTagName("tbody")[0]||a.appendChild(a.ownerDocument.createElement("tbody")):a}function qa(a){return a.type=(null!==a.getAttribute("type"))+"/"+a.type,a}function ra(a){var b=na.exec(a.type);return b?a.type=b[1]:a.removeAttribute("type"),a}function sa(a,b){var c,d,e,f,g,h,i,j;if(1===b.nodeType){if(N.hasData(a)&&(f=N.access(a),g=N.set(b,f),j=f.events)){delete g.handle,g.events={};for(e in j)for(c=0,d=j[e].length;d>c;c++)n.event.add(b,e,j[e][c])}O.hasData(a)&&(h=O.access(a),i=n.extend({},h),O.set(b,i))}}function ta(a,b){var c=b.nodeName.toLowerCase();"input"===c&&X.test(a.type)?b.checked=a.checked:("input"===c||"textarea"===c)&&(b.defaultValue=a.defaultValue)}function ua(a,b,c,d){b=f.apply([],b);var e,g,h,i,j,k,m=0,o=a.length,p=o-1,q=b[0],r=n.isFunction(q);if(r||o>1&&"string"==typeof q&&!l.checkClone&&ma.test(q))return a.each(function(e){var f=a.eq(e);r&&(b[0]=q.call(this,e,f.html())),ua(f,b,c,d)});if(o&&(e=ca(b,a[0].ownerDocument,!1,a,d),g=e.firstChild,1===e.childNodes.length&&(e=g),g||d)){for(h=n.map(_(e,"script"),qa),i=h.length;o>m;m++)j=e,m!==p&&(j=n.clone(j,!0,!0),i&&n.merge(h,_(j,"script"))),c.call(a[m],j,m);if(i)for(k=h[h.length-1].ownerDocument,n.map(h,ra),m=0;i>m;m++)j=h[m],Z.test(j.type||"")&&!N.access(j,"globalEval")&&n.contains(k,j)&&(j.src?n._evalUrl&&n._evalUrl(j.src):n.globalEval(j.textContent.replace(oa,"")))}return a}function va(a,b,c){for(var d,e=b?n.filter(b,a):a,f=0;null!=(d=e[f]);f++)c||1!==d.nodeType||n.cleanData(_(d)),d.parentNode&&(c&&n.contains(d.ownerDocument,d)&&aa(_(d,"script")),d.parentNode.removeChild(d));return a}n.extend({htmlPrefilter:function(a){return a.replace(ka,"<$1></$2>")},clone:function(a,b,c){var d,e,f,g,h=a.cloneNode(!0),i=n.contains(a.ownerDocument,a);if(!(l.noCloneChecked||1!==a.nodeType&&11!==a.nodeType||n.isXMLDoc(a)))for(g=_(h),f=_(a),d=0,e=f.length;e>d;d++)ta(f[d],g[d]);if(b)if(c)for(f=f||_(a),g=g||_(h),d=0,e=f.length;e>d;d++)sa(f[d],g[d]);else sa(a,h);return g=_(h,"script"),g.length>0&&aa(g,!i&&_(a,"script")),h},cleanData:function(a){for(var b,c,d,e=n.event.special,f=0;void 0!==(c=a[f]);f++)if(L(c)){if(b=c[N.expando]){if(b.events)for(d in b.events)e[d]?n.event.remove(c,d):n.removeEvent(c,d,b.handle);c[N.expando]=void 0}c[O.expando]&&(c[O.expando]=void 0)}}}),n.fn.extend({domManip:ua,detach:function(a){return va(this,a,!0)},remove:function(a){return va(this,a)},text:function(a){return K(this,function(a){return void 0===a?n.text(this):this.empty().each(function(){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&(this.textContent=a)})},null,a,arguments.length)},append:function(){return ua(this,arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=pa(this,a);b.appendChild(a)}})},prepend:function(){return ua(this,arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=pa(this,a);b.insertBefore(a,b.firstChild)}})},before:function(){return ua(this,arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this)})},after:function(){return ua(this,arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this.nextSibling)})},empty:function(){for(var a,b=0;null!=(a=this[b]);b++)1===a.nodeType&&(n.cleanData(_(a,!1)),a.textContent="");return this},clone:function(a,b){return a=null==a?!1:a,b=null==b?a:b,this.map(function(){return n.clone(this,a,b)})},html:function(a){return K(this,function(a){var b=this[0]||{},c=0,d=this.length;if(void 0===a&&1===b.nodeType)return b.innerHTML;if("string"==typeof a&&!la.test(a)&&!$[(Y.exec(a)||["",""])[1].toLowerCase()]){a=n.htmlPrefilter(a);try{for(;d>c;c++)b=this[c]||{},1===b.nodeType&&(n.cleanData(_(b,!1)),b.innerHTML=a);b=0}catch(e){}}b&&this.empty().append(a)},null,a,arguments.length)},replaceWith:function(){var a=[];return ua(this,arguments,function(b){var c=this.parentNode;n.inArray(this,a)<0&&(n.cleanData(_(this)),c&&c.replaceChild(b,this))},a)}}),n.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){n.fn[a]=function(a){for(var c,d=[],e=n(a),f=e.length-1,h=0;f>=h;h++)c=h===f?this:this.clone(!0),n(e[h])[b](c),g.apply(d,c.get());return this.pushStack(d)}});var wa,xa={HTML:"block",BODY:"block"};function ya(a,b){var c=n(b.createElement(a)).appendTo(b.body),d=n.css(c[0],"display");return c.detach(),d}function za(a){var b=d,c=xa[a];return c||(c=ya(a,b),"none"!==c&&c||(wa=(wa||n("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement),b=wa[0].contentDocument,b.write(),b.close(),c=ya(a,b),wa.detach()),xa[a]=c),c}var Aa=/^margin/,Ba=new RegExp("^("+S+")(?!px)[a-z%]+$","i"),Ca=function(b){var c=b.ownerDocument.defaultView;return c&&c.opener||(c=a),c.getComputedStyle(b)},Da=function(a,b,c,d){var e,f,g={};for(f in b)g[f]=a.style[f],a.style[f]=b[f];e=c.apply(a,d||[]);for(f in b)a.style[f]=g[f];return e},Ea=d.documentElement;!function(){var b,c,e,f,g=d.createElement("div"),h=d.createElement("div");if(h.style){h.style.backgroundClip="content-box",h.cloneNode(!0).style.backgroundClip="",l.clearCloneStyle="content-box"===h.style.backgroundClip,g.style.cssText="border:0;width:8px;height:0;top:0;left:-9999px;padding:0;margin-top:1px;position:absolute",g.appendChild(h);function i(){h.style.cssText="-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;position:relative;display:block;margin:auto;border:1px;padding:1px;top:1%;width:50%",h.innerHTML="",Ea.appendChild(g);var d=a.getComputedStyle(h);b="1%"!==d.top,f="2px"===d.marginLeft,c="4px"===d.width,h.style.marginRight="50%",e="4px"===d.marginRight,Ea.removeChild(g)}n.extend(l,{pixelPosition:function(){return i(),b},boxSizingReliable:function(){return null==c&&i(),c},pixelMarginRight:function(){return null==c&&i(),e},reliableMarginLeft:function(){return null==c&&i(),f},reliableMarginRight:function(){var b,c=h.appendChild(d.createElement("div"));return c.style.cssText=h.style.cssText="-webkit-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0",c.style.marginRight=c.style.width="0",h.style.width="1px",Ea.appendChild(g),b=!parseFloat(a.getComputedStyle(c).marginRight),Ea.removeChild(g),h.removeChild(c),b}})}}();function Fa(a,b,c){var d,e,f,g,h=a.style;return c=c||Ca(a),g=c?c.getPropertyValue(b)||c[b]:void 0,""!==g&&void 0!==g||n.contains(a.ownerDocument,a)||(g=n.style(a,b)),c&&!l.pixelMarginRight()&&Ba.test(g)&&Aa.test(b)&&(d=h.width,e=h.minWidth,f=h.maxWidth,h.minWidth=h.maxWidth=h.width=g,g=c.width,h.width=d,h.minWidth=e,h.maxWidth=f),void 0!==g?g+"":g}function Ga(a,b){return{get:function(){return a()?void delete this.get:(this.get=b).apply(this,arguments)}}}var Ha=/^(none|table(?!-c[ea]).+)/,Ia={position:"absolute",visibility:"hidden",display:"block"},Ja={letterSpacing:"0",fontWeight:"400"},Ka=["Webkit","O","Moz","ms"],La=d.createElement("div").style;function Ma(a){if(a in La)return a;var b=a[0].toUpperCase()+a.slice(1),c=Ka.length;while(c--)if(a=Ka[c]+b,a in La)return a}function Na(a,b,c){var d=T.exec(b);return d?Math.max(0,d[2]-(c||0))+(d[3]||"px"):b}function Oa(a,b,c,d,e){for(var f=c===(d?"border":"content")?4:"width"===b?1:0,g=0;4>f;f+=2)"margin"===c&&(g+=n.css(a,c+U[f],!0,e)),d?("content"===c&&(g-=n.css(a,"padding"+U[f],!0,e)),"margin"!==c&&(g-=n.css(a,"border"+U[f]+"Width",!0,e))):(g+=n.css(a,"padding"+U[f],!0,e),"padding"!==c&&(g+=n.css(a,"border"+U[f]+"Width",!0,e)));return g}function Pa(b,c,e){var f=!0,g="width"===c?b.offsetWidth:b.offsetHeight,h=Ca(b),i="border-box"===n.css(b,"boxSizing",!1,h);if(d.msFullscreenElement&&a.top!==a&&b.getClientRects().length&&(g=Math.round(100*b.getBoundingClientRect()[c])),0>=g||null==g){if(g=Fa(b,c,h),(0>g||null==g)&&(g=b.style[c]),Ba.test(g))return g;f=i&&(l.boxSizingReliable()||g===b.style[c]),g=parseFloat(g)||0}return g+Oa(b,c,e||(i?"border":"content"),f,h)+"px"}function Qa(a,b){for(var c,d,e,f=[],g=0,h=a.length;h>g;g++)d=a[g],d.style&&(f[g]=N.get(d,"olddisplay"),c=d.style.display,b?(f[g]||"none"!==c||(d.style.display=""),""===d.style.display&&V(d)&&(f[g]=N.access(d,"olddisplay",za(d.nodeName)))):(e=V(d),"none"===c&&e||N.set(d,"olddisplay",e?c:n.css(d,"display"))));for(g=0;h>g;g++)d=a[g],d.style&&(b&&"none"!==d.style.display&&""!==d.style.display||(d.style.display=b?f[g]||"":"none"));return a}n.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=Fa(a,"opacity");return""===c?"1":c}}}},cssNumber:{animationIterationCount:!0,columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":"cssFloat"},style:function(a,b,c,d){if(a&&3!==a.nodeType&&8!==a.nodeType&&a.style){var e,f,g,h=n.camelCase(b),i=a.style;return b=n.cssProps[h]||(n.cssProps[h]=Ma(h)||h),g=n.cssHooks[b]||n.cssHooks[h],void 0===c?g&&"get"in g&&void 0!==(e=g.get(a,!1,d))?e:i[b]:(f=typeof c,"string"===f&&(e=T.exec(c))&&e[1]&&(c=W(a,b,e),f="number"),null!=c&&c===c&&("number"===f&&(c+=e&&e[3]||(n.cssNumber[h]?"":"px")),l.clearCloneStyle||""!==c||0!==b.indexOf("background")||(i[b]="inherit"),g&&"set"in g&&void 0===(c=g.set(a,c,d))||(i[b]=c)),void 0)}},css:function(a,b,c,d){var e,f,g,h=n.camelCase(b);return b=n.cssProps[h]||(n.cssProps[h]=Ma(h)||h),g=n.cssHooks[b]||n.cssHooks[h],g&&"get"in g&&(e=g.get(a,!0,c)),void 0===e&&(e=Fa(a,b,d)),"normal"===e&&b in Ja&&(e=Ja[b]),""===c||c?(f=parseFloat(e),c===!0||isFinite(f)?f||0:e):e}}),n.each(["height","width"],function(a,b){n.cssHooks[b]={get:function(a,c,d){return c?Ha.test(n.css(a,"display"))&&0===a.offsetWidth?Da(a,Ia,function(){return Pa(a,b,d)}):Pa(a,b,d):void 0},set:function(a,c,d){var e,f=d&&Ca(a),g=d&&Oa(a,b,d,"border-box"===n.css(a,"boxSizing",!1,f),f);return g&&(e=T.exec(c))&&"px"!==(e[3]||"px")&&(a.style[b]=c,c=n.css(a,b)),Na(a,c,g)}}}),n.cssHooks.marginLeft=Ga(l.reliableMarginLeft,function(a,b){return b?(parseFloat(Fa(a,"marginLeft"))||a.getBoundingClientRect().left-Da(a,{marginLeft:0},function(){return a.getBoundingClientRect().left}))+"px":void 0}),n.cssHooks.marginRight=Ga(l.reliableMarginRight,function(a,b){return b?Da(a,{display:"inline-block"},Fa,[a,"marginRight"]):void 0}),n.each({margin:"",padding:"",border:"Width"},function(a,b){n.cssHooks[a+b]={expand:function(c){for(var d=0,e={},f="string"==typeof c?c.split(" "):[c];4>d;d++)e[a+U[d]+b]=f[d]||f[d-2]||f[0];return e}},Aa.test(a)||(n.cssHooks[a+b].set=Na)}),n.fn.extend({css:function(a,b){return K(this,function(a,b,c){var d,e,f={},g=0;if(n.isArray(b)){for(d=Ca(a),e=b.length;e>g;g++)f[b[g]]=n.css(a,b[g],!1,d);return f}return void 0!==c?n.style(a,b,c):n.css(a,b)},a,b,arguments.length>1)},show:function(){return Qa(this,!0)},hide:function(){return Qa(this)},toggle:function(a){return"boolean"==typeof a?a?this.show():this.hide():this.each(function(){V(this)?n(this).show():n(this).hide()})}});function Ra(a,b,c,d,e){return new Ra.prototype.init(a,b,c,d,e)}n.Tween=Ra,Ra.prototype={constructor:Ra,init:function(a,b,c,d,e,f){this.elem=a,this.prop=c,this.easing=e||n.easing._default,this.options=b,this.start=this.now=this.cur(),this.end=d,this.unit=f||(n.cssNumber[c]?"":"px")},cur:function(){var a=Ra.propHooks[this.prop];return a&&a.get?a.get(this):Ra.propHooks._default.get(this)},run:function(a){var b,c=Ra.propHooks[this.prop];return this.options.duration?this.pos=b=n.easing[this.easing](a,this.options.duration*a,0,1,this.options.duration):this.pos=b=a,this.now=(this.end-this.start)*b+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),c&&c.set?c.set(this):Ra.propHooks._default.set(this),this}},Ra.prototype.init.prototype=Ra.prototype,Ra.propHooks={_default:{get:function(a){var b;return 1!==a.elem.nodeType||null!=a.elem[a.prop]&&null==a.elem.style[a.prop]?a.elem[a.prop]:(b=n.css(a.elem,a.prop,""),b&&"auto"!==b?b:0)},set:function(a){n.fx.step[a.prop]?n.fx.step[a.prop](a):1!==a.elem.nodeType||null==a.elem.style[n.cssProps[a.prop]]&&!n.cssHooks[a.prop]?a.elem[a.prop]=a.now:n.style(a.elem,a.prop,a.now+a.unit)}}},Ra.propHooks.scrollTop=Ra.propHooks.scrollLeft={set:function(a){a.elem.nodeType&&a.elem.parentNode&&(a.elem[a.prop]=a.now)}},n.easing={linear:function(a){return a},swing:function(a){return.5-Math.cos(a*Math.PI)/2},_default:"swing"},n.fx=Ra.prototype.init,n.fx.step={};var Sa,Ta,Ua=/^(?:toggle|show|hide)$/,Va=/queueHooks$/;function Wa(){return a.setTimeout(function(){Sa=void 0}),Sa=n.now()}function Xa(a,b){var c,d=0,e={height:a};for(b=b?1:0;4>d;d+=2-b)c=U[d],e["margin"+c]=e["padding"+c]=a;return b&&(e.opacity=e.width=a),e}function Ya(a,b,c){for(var d,e=(_a.tweeners[b]||[]).concat(_a.tweeners["*"]),f=0,g=e.length;g>f;f++)if(d=e[f].call(c,b,a))return d}function Za(a,b,c){var d,e,f,g,h,i,j,k,l=this,m={},o=a.style,p=a.nodeType&&V(a),q=N.get(a,"fxshow");c.queue||(h=n._queueHooks(a,"fx"),null==h.unqueued&&(h.unqueued=0,i=h.empty.fire,h.empty.fire=function(){h.unqueued||i()}),h.unqueued++,l.always(function(){l.always(function(){h.unqueued--,n.queue(a,"fx").length||h.empty.fire()})})),1===a.nodeType&&("height"in b||"width"in b)&&(c.overflow=[o.overflow,o.overflowX,o.overflowY],j=n.css(a,"display"),k="none"===j?N.get(a,"olddisplay")||za(a.nodeName):j,"inline"===k&&"none"===n.css(a,"float")&&(o.display="inline-block")),c.overflow&&(o.overflow="hidden",l.always(function(){o.overflow=c.overflow[0],o.overflowX=c.overflow[1],o.overflowY=c.overflow[2]}));for(d in b)if(e=b[d],Ua.exec(e)){if(delete b[d],f=f||"toggle"===e,e===(p?"hide":"show")){if("show"!==e||!q||void 0===q[d])continue;p=!0}m[d]=q&&q[d]||n.style(a,d)}else j=void 0;if(n.isEmptyObject(m))"inline"===("none"===j?za(a.nodeName):j)&&(o.display=j);else{q?"hidden"in q&&(p=q.hidden):q=N.access(a,"fxshow",{}),f&&(q.hidden=!p),p?n(a).show():l.done(function(){n(a).hide()}),l.done(function(){var b;N.remove(a,"fxshow");for(b in m)n.style(a,b,m[b])});for(d in m)g=Ya(p?q[d]:0,d,l),d in q||(q[d]=g.start,p&&(g.end=g.start,g.start="width"===d||"height"===d?1:0))}}function $a(a,b){var c,d,e,f,g;for(c in a)if(d=n.camelCase(c),e=b[d],f=a[c],n.isArray(f)&&(e=f[1],f=a[c]=f[0]),c!==d&&(a[d]=f,delete a[c]),g=n.cssHooks[d],g&&"expand"in g){f=g.expand(f),delete a[d];for(c in f)c in a||(a[c]=f[c],b[c]=e)}else b[d]=e}function _a(a,b,c){var d,e,f=0,g=_a.prefilters.length,h=n.Deferred().always(function(){delete i.elem}),i=function(){if(e)return!1;for(var b=Sa||Wa(),c=Math.max(0,j.startTime+j.duration-b),d=c/j.duration||0,f=1-d,g=0,i=j.tweens.length;i>g;g++)j.tweens[g].run(f);return h.notifyWith(a,[j,f,c]),1>f&&i?c:(h.resolveWith(a,[j]),!1)},j=h.promise({elem:a,props:n.extend({},b),opts:n.extend(!0,{specialEasing:{},easing:n.easing._default},c),originalProperties:b,originalOptions:c,startTime:Sa||Wa(),duration:c.duration,tweens:[],createTween:function(b,c){var d=n.Tween(a,j.opts,b,c,j.opts.specialEasing[b]||j.opts.easing);return j.tweens.push(d),d},stop:function(b){var c=0,d=b?j.tweens.length:0;if(e)return this;for(e=!0;d>c;c++)j.tweens[c].run(1);return b?(h.notifyWith(a,[j,1,0]),h.resolveWith(a,[j,b])):h.rejectWith(a,[j,b]),this}}),k=j.props;for($a(k,j.opts.specialEasing);g>f;f++)if(d=_a.prefilters[f].call(j,a,k,j.opts))return n.isFunction(d.stop)&&(n._queueHooks(j.elem,j.opts.queue).stop=n.proxy(d.stop,d)),d;return n.map(k,Ya,j),n.isFunction(j.opts.start)&&j.opts.start.call(a,j),n.fx.timer(n.extend(i,{elem:a,anim:j,queue:j.opts.queue})),j.progress(j.opts.progress).done(j.opts.done,j.opts.complete).fail(j.opts.fail).always(j.opts.always)}n.Animation=n.extend(_a,{tweeners:{"*":[function(a,b){var c=this.createTween(a,b);return W(c.elem,a,T.exec(b),c),c}]},tweener:function(a,b){n.isFunction(a)?(b=a,a=["*"]):a=a.match(G);for(var c,d=0,e=a.length;e>d;d++)c=a[d],_a.tweeners[c]=_a.tweeners[c]||[],_a.tweeners[c].unshift(b)},prefilters:[Za],prefilter:function(a,b){b?_a.prefilters.unshift(a):_a.prefilters.push(a)}}),n.speed=function(a,b,c){var d=a&&"object"==typeof a?n.extend({},a):{complete:c||!c&&b||n.isFunction(a)&&a,duration:a,easing:c&&b||b&&!n.isFunction(b)&&b};return d.duration=n.fx.off?0:"number"==typeof d.duration?d.duration:d.duration in n.fx.speeds?n.fx.speeds[d.duration]:n.fx.speeds._default,(null==d.queue||d.queue===!0)&&(d.queue="fx"),d.old=d.complete,d.complete=function(){n.isFunction(d.old)&&d.old.call(this),d.queue&&n.dequeue(this,d.queue)},d},n.fn.extend({fadeTo:function(a,b,c,d){return this.filter(V).css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){var e=n.isEmptyObject(a),f=n.speed(b,c,d),g=function(){var b=_a(this,n.extend({},a),f);(e||N.get(this,"finish"))&&b.stop(!0)};return g.finish=g,e||f.queue===!1?this.each(g):this.queue(f.queue,g)},stop:function(a,b,c){var d=function(a){var b=a.stop;delete a.stop,b(c)};return"string"!=typeof a&&(c=b,b=a,a=void 0),b&&a!==!1&&this.queue(a||"fx",[]),this.each(function(){var b=!0,e=null!=a&&a+"queueHooks",f=n.timers,g=N.get(this);if(e)g[e]&&g[e].stop&&d(g[e]);else for(e in g)g[e]&&g[e].stop&&Va.test(e)&&d(g[e]);for(e=f.length;e--;)f[e].elem!==this||null!=a&&f[e].queue!==a||(f[e].anim.stop(c),b=!1,f.splice(e,1));(b||!c)&&n.dequeue(this,a)})},finish:function(a){return a!==!1&&(a=a||"fx"),this.each(function(){var b,c=N.get(this),d=c[a+"queue"],e=c[a+"queueHooks"],f=n.timers,g=d?d.length:0;for(c.finish=!0,n.queue(this,a,[]),e&&e.stop&&e.stop.call(this,!0),b=f.length;b--;)f[b].elem===this&&f[b].queue===a&&(f[b].anim.stop(!0),f.splice(b,1));for(b=0;g>b;b++)d[b]&&d[b].finish&&d[b].finish.call(this);delete c.finish})}}),n.each(["toggle","show","hide"],function(a,b){var c=n.fn[b];n.fn[b]=function(a,d,e){return null==a||"boolean"==typeof a?c.apply(this,arguments):this.animate(Xa(b,!0),a,d,e)}}),n.each({slideDown:Xa("show"),slideUp:Xa("hide"),slideToggle:Xa("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){n.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),n.timers=[],n.fx.tick=function(){var a,b=0,c=n.timers;for(Sa=n.now();b<c.length;b++)a=c[b],a()||c[b]!==a||c.splice(b--,1);c.length||n.fx.stop(),Sa=void 0},n.fx.timer=function(a){n.timers.push(a),a()?n.fx.start():n.timers.pop()},n.fx.interval=13,n.fx.start=function(){Ta||(Ta=a.setInterval(n.fx.tick,n.fx.interval))},n.fx.stop=function(){a.clearInterval(Ta),Ta=null},n.fx.speeds={slow:600,fast:200,_default:400},n.fn.delay=function(b,c){return b=n.fx?n.fx.speeds[b]||b:b,c=c||"fx",this.queue(c,function(c,d){var e=a.setTimeout(c,b);d.stop=function(){a.clearTimeout(e)}})},function(){var a=d.createElement("input"),b=d.createElement("select"),c=b.appendChild(d.createElement("option"));a.type="checkbox",l.checkOn=""!==a.value,l.optSelected=c.selected,b.disabled=!0,l.optDisabled=!c.disabled,a=d.createElement("input"),a.value="t",a.type="radio",l.radioValue="t"===a.value}();var ab,bb=n.expr.attrHandle;n.fn.extend({attr:function(a,b){return K(this,n.attr,a,b,arguments.length>1)},removeAttr:function(a){return this.each(function(){n.removeAttr(this,a)})}}),n.extend({attr:function(a,b,c){var d,e,f=a.nodeType;if(3!==f&&8!==f&&2!==f)return"undefined"==typeof a.getAttribute?n.prop(a,b,c):(1===f&&n.isXMLDoc(a)||(b=b.toLowerCase(),e=n.attrHooks[b]||(n.expr.match.bool.test(b)?ab:void 0)),void 0!==c?null===c?void n.removeAttr(a,b):e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:(a.setAttribute(b,c+""),c):e&&"get"in e&&null!==(d=e.get(a,b))?d:(d=n.find.attr(a,b),null==d?void 0:d))},attrHooks:{type:{set:function(a,b){if(!l.radioValue&&"radio"===b&&n.nodeName(a,"input")){var c=a.value;return a.setAttribute("type",b),c&&(a.value=c),b}}}},removeAttr:function(a,b){var c,d,e=0,f=b&&b.match(G);if(f&&1===a.nodeType)while(c=f[e++])d=n.propFix[c]||c,n.expr.match.bool.test(c)&&(a[d]=!1),a.removeAttribute(c)}}),ab={set:function(a,b,c){return b===!1?n.removeAttr(a,c):a.setAttribute(c,c),c}},n.each(n.expr.match.bool.source.match(/\w+/g),function(a,b){var c=bb[b]||n.find.attr;bb[b]=function(a,b,d){var e,f;return d||(f=bb[b],bb[b]=e,e=null!=c(a,b,d)?b.toLowerCase():null,bb[b]=f),e}});var cb=/^(?:input|select|textarea|button)$/i,db=/^(?:a|area)$/i;n.fn.extend({prop:function(a,b){return K(this,n.prop,a,b,arguments.length>1)},removeProp:function(a){return this.each(function(){delete this[n.propFix[a]||a]})}}),n.extend({prop:function(a,b,c){var d,e,f=a.nodeType;if(3!==f&&8!==f&&2!==f)return 1===f&&n.isXMLDoc(a)||(b=n.propFix[b]||b,
e=n.propHooks[b]),void 0!==c?e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:a[b]=c:e&&"get"in e&&null!==(d=e.get(a,b))?d:a[b]},propHooks:{tabIndex:{get:function(a){var b=n.find.attr(a,"tabindex");return b?parseInt(b,10):cb.test(a.nodeName)||db.test(a.nodeName)&&a.href?0:-1}}},propFix:{"for":"htmlFor","class":"className"}}),l.optSelected||(n.propHooks.selected={get:function(a){var b=a.parentNode;return b&&b.parentNode&&b.parentNode.selectedIndex,null}}),n.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){n.propFix[this.toLowerCase()]=this});var eb=/[\t\r\n\f]/g;function fb(a){return a.getAttribute&&a.getAttribute("class")||""}n.fn.extend({addClass:function(a){var b,c,d,e,f,g,h,i=0;if(n.isFunction(a))return this.each(function(b){n(this).addClass(a.call(this,b,fb(this)))});if("string"==typeof a&&a){b=a.match(G)||[];while(c=this[i++])if(e=fb(c),d=1===c.nodeType&&(" "+e+" ").replace(eb," ")){g=0;while(f=b[g++])d.indexOf(" "+f+" ")<0&&(d+=f+" ");h=n.trim(d),e!==h&&c.setAttribute("class",h)}}return this},removeClass:function(a){var b,c,d,e,f,g,h,i=0;if(n.isFunction(a))return this.each(function(b){n(this).removeClass(a.call(this,b,fb(this)))});if(!arguments.length)return this.attr("class","");if("string"==typeof a&&a){b=a.match(G)||[];while(c=this[i++])if(e=fb(c),d=1===c.nodeType&&(" "+e+" ").replace(eb," ")){g=0;while(f=b[g++])while(d.indexOf(" "+f+" ")>-1)d=d.replace(" "+f+" "," ");h=n.trim(d),e!==h&&c.setAttribute("class",h)}}return this},toggleClass:function(a,b){var c=typeof a;return"boolean"==typeof b&&"string"===c?b?this.addClass(a):this.removeClass(a):n.isFunction(a)?this.each(function(c){n(this).toggleClass(a.call(this,c,fb(this),b),b)}):this.each(function(){var b,d,e,f;if("string"===c){d=0,e=n(this),f=a.match(G)||[];while(b=f[d++])e.hasClass(b)?e.removeClass(b):e.addClass(b)}else(void 0===a||"boolean"===c)&&(b=fb(this),b&&N.set(this,"__className__",b),this.setAttribute&&this.setAttribute("class",b||a===!1?"":N.get(this,"__className__")||""))})},hasClass:function(a){var b,c,d=0;b=" "+a+" ";while(c=this[d++])if(1===c.nodeType&&(" "+fb(c)+" ").replace(eb," ").indexOf(b)>-1)return!0;return!1}});var gb=/\r/g;n.fn.extend({val:function(a){var b,c,d,e=this[0];{if(arguments.length)return d=n.isFunction(a),this.each(function(c){var e;1===this.nodeType&&(e=d?a.call(this,c,n(this).val()):a,null==e?e="":"number"==typeof e?e+="":n.isArray(e)&&(e=n.map(e,function(a){return null==a?"":a+""})),b=n.valHooks[this.type]||n.valHooks[this.nodeName.toLowerCase()],b&&"set"in b&&void 0!==b.set(this,e,"value")||(this.value=e))});if(e)return b=n.valHooks[e.type]||n.valHooks[e.nodeName.toLowerCase()],b&&"get"in b&&void 0!==(c=b.get(e,"value"))?c:(c=e.value,"string"==typeof c?c.replace(gb,""):null==c?"":c)}}}),n.extend({valHooks:{option:{get:function(a){return n.trim(a.value)}},select:{get:function(a){for(var b,c,d=a.options,e=a.selectedIndex,f="select-one"===a.type||0>e,g=f?null:[],h=f?e+1:d.length,i=0>e?h:f?e:0;h>i;i++)if(c=d[i],(c.selected||i===e)&&(l.optDisabled?!c.disabled:null===c.getAttribute("disabled"))&&(!c.parentNode.disabled||!n.nodeName(c.parentNode,"optgroup"))){if(b=n(c).val(),f)return b;g.push(b)}return g},set:function(a,b){var c,d,e=a.options,f=n.makeArray(b),g=e.length;while(g--)d=e[g],(d.selected=n.inArray(n.valHooks.option.get(d),f)>-1)&&(c=!0);return c||(a.selectedIndex=-1),f}}}}),n.each(["radio","checkbox"],function(){n.valHooks[this]={set:function(a,b){return n.isArray(b)?a.checked=n.inArray(n(a).val(),b)>-1:void 0}},l.checkOn||(n.valHooks[this].get=function(a){return null===a.getAttribute("value")?"on":a.value})});var hb=/^(?:focusinfocus|focusoutblur)$/;n.extend(n.event,{trigger:function(b,c,e,f){var g,h,i,j,l,m,o,p=[e||d],q=k.call(b,"type")?b.type:b,r=k.call(b,"namespace")?b.namespace.split("."):[];if(h=i=e=e||d,3!==e.nodeType&&8!==e.nodeType&&!hb.test(q+n.event.triggered)&&(q.indexOf(".")>-1&&(r=q.split("."),q=r.shift(),r.sort()),l=q.indexOf(":")<0&&"on"+q,b=b[n.expando]?b:new n.Event(q,"object"==typeof b&&b),b.isTrigger=f?2:3,b.namespace=r.join("."),b.rnamespace=b.namespace?new RegExp("(^|\\.)"+r.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,b.result=void 0,b.target||(b.target=e),c=null==c?[b]:n.makeArray(c,[b]),o=n.event.special[q]||{},f||!o.trigger||o.trigger.apply(e,c)!==!1)){if(!f&&!o.noBubble&&!n.isWindow(e)){for(j=o.delegateType||q,hb.test(j+q)||(h=h.parentNode);h;h=h.parentNode)p.push(h),i=h;i===(e.ownerDocument||d)&&p.push(i.defaultView||i.parentWindow||a)}g=0;while((h=p[g++])&&!b.isPropagationStopped())b.type=g>1?j:o.bindType||q,m=(N.get(h,"events")||{})[b.type]&&N.get(h,"handle"),m&&m.apply(h,c),m=l&&h[l],m&&m.apply&&L(h)&&(b.result=m.apply(h,c),b.result===!1&&b.preventDefault());return b.type=q,f||b.isDefaultPrevented()||o._default&&o._default.apply(p.pop(),c)!==!1||!L(e)||l&&n.isFunction(e[q])&&!n.isWindow(e)&&(i=e[l],i&&(e[l]=null),n.event.triggered=q,e[q](),n.event.triggered=void 0,i&&(e[l]=i)),b.result}},simulate:function(a,b,c){var d=n.extend(new n.Event,c,{type:a,isSimulated:!0});n.event.trigger(d,null,b),d.isDefaultPrevented()&&c.preventDefault()}}),n.fn.extend({trigger:function(a,b){return this.each(function(){n.event.trigger(a,b,this)})},triggerHandler:function(a,b){var c=this[0];return c?n.event.trigger(a,b,c,!0):void 0}}),n.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(a,b){n.fn[b]=function(a,c){return arguments.length>0?this.on(b,null,a,c):this.trigger(b)}}),n.fn.extend({hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)}}),l.focusin="onfocusin"in a,l.focusin||n.each({focus:"focusin",blur:"focusout"},function(a,b){var c=function(a){n.event.simulate(b,a.target,n.event.fix(a))};n.event.special[b]={setup:function(){var d=this.ownerDocument||this,e=N.access(d,b);e||d.addEventListener(a,c,!0),N.access(d,b,(e||0)+1)},teardown:function(){var d=this.ownerDocument||this,e=N.access(d,b)-1;e?N.access(d,b,e):(d.removeEventListener(a,c,!0),N.remove(d,b))}}});var ib=a.location,jb=n.now(),kb=/\?/;n.parseJSON=function(a){return JSON.parse(a+"")},n.parseXML=function(b){var c;if(!b||"string"!=typeof b)return null;try{c=(new a.DOMParser).parseFromString(b,"text/xml")}catch(d){c=void 0}return(!c||c.getElementsByTagName("parsererror").length)&&n.error("Invalid XML: "+b),c};var lb=/#.*$/,mb=/([?&])_=[^&]*/,nb=/^(.*?):[ \t]*([^\r\n]*)$/gm,ob=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,pb=/^(?:GET|HEAD)$/,qb=/^\/\//,rb={},sb={},tb="*/".concat("*"),ub=d.createElement("a");ub.href=ib.href;function vb(a){return function(b,c){"string"!=typeof b&&(c=b,b="*");var d,e=0,f=b.toLowerCase().match(G)||[];if(n.isFunction(c))while(d=f[e++])"+"===d[0]?(d=d.slice(1)||"*",(a[d]=a[d]||[]).unshift(c)):(a[d]=a[d]||[]).push(c)}}function wb(a,b,c,d){var e={},f=a===sb;function g(h){var i;return e[h]=!0,n.each(a[h]||[],function(a,h){var j=h(b,c,d);return"string"!=typeof j||f||e[j]?f?!(i=j):void 0:(b.dataTypes.unshift(j),g(j),!1)}),i}return g(b.dataTypes[0])||!e["*"]&&g("*")}function xb(a,b){var c,d,e=n.ajaxSettings.flatOptions||{};for(c in b)void 0!==b[c]&&((e[c]?a:d||(d={}))[c]=b[c]);return d&&n.extend(!0,a,d),a}function yb(a,b,c){var d,e,f,g,h=a.contents,i=a.dataTypes;while("*"===i[0])i.shift(),void 0===d&&(d=a.mimeType||b.getResponseHeader("Content-Type"));if(d)for(e in h)if(h[e]&&h[e].test(d)){i.unshift(e);break}if(i[0]in c)f=i[0];else{for(e in c){if(!i[0]||a.converters[e+" "+i[0]]){f=e;break}g||(g=e)}f=f||g}return f?(f!==i[0]&&i.unshift(f),c[f]):void 0}function zb(a,b,c,d){var e,f,g,h,i,j={},k=a.dataTypes.slice();if(k[1])for(g in a.converters)j[g.toLowerCase()]=a.converters[g];f=k.shift();while(f)if(a.responseFields[f]&&(c[a.responseFields[f]]=b),!i&&d&&a.dataFilter&&(b=a.dataFilter(b,a.dataType)),i=f,f=k.shift())if("*"===f)f=i;else if("*"!==i&&i!==f){if(g=j[i+" "+f]||j["* "+f],!g)for(e in j)if(h=e.split(" "),h[1]===f&&(g=j[i+" "+h[0]]||j["* "+h[0]])){g===!0?g=j[e]:j[e]!==!0&&(f=h[0],k.unshift(h[1]));break}if(g!==!0)if(g&&a["throws"])b=g(b);else try{b=g(b)}catch(l){return{state:"parsererror",error:g?l:"No conversion from "+i+" to "+f}}}return{state:"success",data:b}}n.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:ib.href,type:"GET",isLocal:ob.test(ib.protocol),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":tb,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/\bxml\b/,html:/\bhtml/,json:/\bjson\b/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":n.parseJSON,"text xml":n.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(a,b){return b?xb(xb(a,n.ajaxSettings),b):xb(n.ajaxSettings,a)},ajaxPrefilter:vb(rb),ajaxTransport:vb(sb),ajax:function(b,c){"object"==typeof b&&(c=b,b=void 0),c=c||{};var e,f,g,h,i,j,k,l,m=n.ajaxSetup({},c),o=m.context||m,p=m.context&&(o.nodeType||o.jquery)?n(o):n.event,q=n.Deferred(),r=n.Callbacks("once memory"),s=m.statusCode||{},t={},u={},v=0,w="canceled",x={readyState:0,getResponseHeader:function(a){var b;if(2===v){if(!h){h={};while(b=nb.exec(g))h[b[1].toLowerCase()]=b[2]}b=h[a.toLowerCase()]}return null==b?null:b},getAllResponseHeaders:function(){return 2===v?g:null},setRequestHeader:function(a,b){var c=a.toLowerCase();return v||(a=u[c]=u[c]||a,t[a]=b),this},overrideMimeType:function(a){return v||(m.mimeType=a),this},statusCode:function(a){var b;if(a)if(2>v)for(b in a)s[b]=[s[b],a[b]];else x.always(a[x.status]);return this},abort:function(a){var b=a||w;return e&&e.abort(b),z(0,b),this}};if(q.promise(x).complete=r.add,x.success=x.done,x.error=x.fail,m.url=((b||m.url||ib.href)+"").replace(lb,"").replace(qb,ib.protocol+"//"),m.type=c.method||c.type||m.method||m.type,m.dataTypes=n.trim(m.dataType||"*").toLowerCase().match(G)||[""],null==m.crossDomain){j=d.createElement("a");try{j.href=m.url,j.href=j.href,m.crossDomain=ub.protocol+"//"+ub.host!=j.protocol+"//"+j.host}catch(y){m.crossDomain=!0}}if(m.data&&m.processData&&"string"!=typeof m.data&&(m.data=n.param(m.data,m.traditional)),wb(rb,m,c,x),2===v)return x;k=n.event&&m.global,k&&0===n.active++&&n.event.trigger("ajaxStart"),m.type=m.type.toUpperCase(),m.hasContent=!pb.test(m.type),f=m.url,m.hasContent||(m.data&&(f=m.url+=(kb.test(f)?"&":"?")+m.data,delete m.data),m.cache===!1&&(m.url=mb.test(f)?f.replace(mb,"$1_="+jb++):f+(kb.test(f)?"&":"?")+"_="+jb++)),m.ifModified&&(n.lastModified[f]&&x.setRequestHeader("If-Modified-Since",n.lastModified[f]),n.etag[f]&&x.setRequestHeader("If-None-Match",n.etag[f])),(m.data&&m.hasContent&&m.contentType!==!1||c.contentType)&&x.setRequestHeader("Content-Type",m.contentType),x.setRequestHeader("Accept",m.dataTypes[0]&&m.accepts[m.dataTypes[0]]?m.accepts[m.dataTypes[0]]+("*"!==m.dataTypes[0]?", "+tb+"; q=0.01":""):m.accepts["*"]);for(l in m.headers)x.setRequestHeader(l,m.headers[l]);if(m.beforeSend&&(m.beforeSend.call(o,x,m)===!1||2===v))return x.abort();w="abort";for(l in{success:1,error:1,complete:1})x[l](m[l]);if(e=wb(sb,m,c,x)){if(x.readyState=1,k&&p.trigger("ajaxSend",[x,m]),2===v)return x;m.async&&m.timeout>0&&(i=a.setTimeout(function(){x.abort("timeout")},m.timeout));try{v=1,e.send(t,z)}catch(y){if(!(2>v))throw y;z(-1,y)}}else z(-1,"No Transport");function z(b,c,d,h){var j,l,t,u,w,y=c;2!==v&&(v=2,i&&a.clearTimeout(i),e=void 0,g=h||"",x.readyState=b>0?4:0,j=b>=200&&300>b||304===b,d&&(u=yb(m,x,d)),u=zb(m,u,x,j),j?(m.ifModified&&(w=x.getResponseHeader("Last-Modified"),w&&(n.lastModified[f]=w),w=x.getResponseHeader("etag"),w&&(n.etag[f]=w)),204===b||"HEAD"===m.type?y="nocontent":304===b?y="notmodified":(y=u.state,l=u.data,t=u.error,j=!t)):(t=y,(b||!y)&&(y="error",0>b&&(b=0))),x.status=b,x.statusText=(c||y)+"",j?q.resolveWith(o,[l,y,x]):q.rejectWith(o,[x,y,t]),x.statusCode(s),s=void 0,k&&p.trigger(j?"ajaxSuccess":"ajaxError",[x,m,j?l:t]),r.fireWith(o,[x,y]),k&&(p.trigger("ajaxComplete",[x,m]),--n.active||n.event.trigger("ajaxStop")))}return x},getJSON:function(a,b,c){return n.get(a,b,c,"json")},getScript:function(a,b){return n.get(a,void 0,b,"script")}}),n.each(["get","post"],function(a,b){n[b]=function(a,c,d,e){return n.isFunction(c)&&(e=e||d,d=c,c=void 0),n.ajax(n.extend({url:a,type:b,dataType:e,data:c,success:d},n.isPlainObject(a)&&a))}}),n._evalUrl=function(a){return n.ajax({url:a,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})},n.fn.extend({wrapAll:function(a){var b;return n.isFunction(a)?this.each(function(b){n(this).wrapAll(a.call(this,b))}):(this[0]&&(b=n(a,this[0].ownerDocument).eq(0).clone(!0),this[0].parentNode&&b.insertBefore(this[0]),b.map(function(){var a=this;while(a.firstElementChild)a=a.firstElementChild;return a}).append(this)),this)},wrapInner:function(a){return n.isFunction(a)?this.each(function(b){n(this).wrapInner(a.call(this,b))}):this.each(function(){var b=n(this),c=b.contents();c.length?c.wrapAll(a):b.append(a)})},wrap:function(a){var b=n.isFunction(a);return this.each(function(c){n(this).wrapAll(b?a.call(this,c):a)})},unwrap:function(){return this.parent().each(function(){n.nodeName(this,"body")||n(this).replaceWith(this.childNodes)}).end()}}),n.expr.filters.hidden=function(a){return!n.expr.filters.visible(a)},n.expr.filters.visible=function(a){return a.offsetWidth>0||a.offsetHeight>0||a.getClientRects().length>0};var Ab=/%20/g,Bb=/\[\]$/,Cb=/\r?\n/g,Db=/^(?:submit|button|image|reset|file)$/i,Eb=/^(?:input|select|textarea|keygen)/i;function Fb(a,b,c,d){var e;if(n.isArray(b))n.each(b,function(b,e){c||Bb.test(a)?d(a,e):Fb(a+"["+("object"==typeof e&&null!=e?b:"")+"]",e,c,d)});else if(c||"object"!==n.type(b))d(a,b);else for(e in b)Fb(a+"["+e+"]",b[e],c,d)}n.param=function(a,b){var c,d=[],e=function(a,b){b=n.isFunction(b)?b():null==b?"":b,d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(b)};if(void 0===b&&(b=n.ajaxSettings&&n.ajaxSettings.traditional),n.isArray(a)||a.jquery&&!n.isPlainObject(a))n.each(a,function(){e(this.name,this.value)});else for(c in a)Fb(c,a[c],b,e);return d.join("&").replace(Ab,"+")},n.fn.extend({serialize:function(){return n.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var a=n.prop(this,"elements");return a?n.makeArray(a):this}).filter(function(){var a=this.type;return this.name&&!n(this).is(":disabled")&&Eb.test(this.nodeName)&&!Db.test(a)&&(this.checked||!X.test(a))}).map(function(a,b){var c=n(this).val();return null==c?null:n.isArray(c)?n.map(c,function(a){return{name:b.name,value:a.replace(Cb,"\r\n")}}):{name:b.name,value:c.replace(Cb,"\r\n")}}).get()}}),n.ajaxSettings.xhr=function(){try{return new a.XMLHttpRequest}catch(b){}};var Gb={0:200,1223:204},Hb=n.ajaxSettings.xhr();l.cors=!!Hb&&"withCredentials"in Hb,l.ajax=Hb=!!Hb,n.ajaxTransport(function(b){var c,d;return l.cors||Hb&&!b.crossDomain?{send:function(e,f){var g,h=b.xhr();if(h.open(b.type,b.url,b.async,b.username,b.password),b.xhrFields)for(g in b.xhrFields)h[g]=b.xhrFields[g];b.mimeType&&h.overrideMimeType&&h.overrideMimeType(b.mimeType),b.crossDomain||e["X-Requested-With"]||(e["X-Requested-With"]="XMLHttpRequest");for(g in e)h.setRequestHeader(g,e[g]);c=function(a){return function(){c&&(c=d=h.onload=h.onerror=h.onabort=h.onreadystatechange=null,"abort"===a?h.abort():"error"===a?"number"!=typeof h.status?f(0,"error"):f(h.status,h.statusText):f(Gb[h.status]||h.status,h.statusText,"text"!==(h.responseType||"text")||"string"!=typeof h.responseText?{binary:h.response}:{text:h.responseText},h.getAllResponseHeaders()))}},h.onload=c(),d=h.onerror=c("error"),void 0!==h.onabort?h.onabort=d:h.onreadystatechange=function(){4===h.readyState&&a.setTimeout(function(){c&&d()})},c=c("abort");try{h.send(b.hasContent&&b.data||null)}catch(i){if(c)throw i}},abort:function(){c&&c()}}:void 0}),n.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/\b(?:java|ecma)script\b/},converters:{"text script":function(a){return n.globalEval(a),a}}}),n.ajaxPrefilter("script",function(a){void 0===a.cache&&(a.cache=!1),a.crossDomain&&(a.type="GET")}),n.ajaxTransport("script",function(a){if(a.crossDomain){var b,c;return{send:function(e,f){b=n("<script>").prop({charset:a.scriptCharset,src:a.url}).on("load error",c=function(a){b.remove(),c=null,a&&f("error"===a.type?404:200,a.type)}),d.head.appendChild(b[0])},abort:function(){c&&c()}}}});var Ib=[],Jb=/(=)\?(?=&|$)|\?\?/;n.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var a=Ib.pop()||n.expando+"_"+jb++;return this[a]=!0,a}}),n.ajaxPrefilter("json jsonp",function(b,c,d){var e,f,g,h=b.jsonp!==!1&&(Jb.test(b.url)?"url":"string"==typeof b.data&&0===(b.contentType||"").indexOf("application/x-www-form-urlencoded")&&Jb.test(b.data)&&"data");return h||"jsonp"===b.dataTypes[0]?(e=b.jsonpCallback=n.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,h?b[h]=b[h].replace(Jb,"$1"+e):b.jsonp!==!1&&(b.url+=(kb.test(b.url)?"&":"?")+b.jsonp+"="+e),b.converters["script json"]=function(){return g||n.error(e+" was not called"),g[0]},b.dataTypes[0]="json",f=a[e],a[e]=function(){g=arguments},d.always(function(){void 0===f?n(a).removeProp(e):a[e]=f,b[e]&&(b.jsonpCallback=c.jsonpCallback,Ib.push(e)),g&&n.isFunction(f)&&f(g[0]),g=f=void 0}),"script"):void 0}),l.createHTMLDocument=function(){var a=d.implementation.createHTMLDocument("").body;return a.innerHTML="<form></form><form></form>",2===a.childNodes.length}(),n.parseHTML=function(a,b,c){if(!a||"string"!=typeof a)return null;"boolean"==typeof b&&(c=b,b=!1),b=b||(l.createHTMLDocument?d.implementation.createHTMLDocument(""):d);var e=x.exec(a),f=!c&&[];return e?[b.createElement(e[1])]:(e=ca([a],b,f),f&&f.length&&n(f).remove(),n.merge([],e.childNodes))};var Kb=n.fn.load;n.fn.load=function(a,b,c){if("string"!=typeof a&&Kb)return Kb.apply(this,arguments);var d,e,f,g=this,h=a.indexOf(" ");return h>-1&&(d=n.trim(a.slice(h)),a=a.slice(0,h)),n.isFunction(b)?(c=b,b=void 0):b&&"object"==typeof b&&(e="POST"),g.length>0&&n.ajax({url:a,type:e||"GET",dataType:"html",data:b}).done(function(a){f=arguments,g.html(d?n("<div>").append(n.parseHTML(a)).find(d):a)}).always(c&&function(a,b){g.each(function(){c.apply(g,f||[a.responseText,b,a])})}),this},n.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(a,b){n.fn[b]=function(a){return this.on(b,a)}}),n.expr.filters.animated=function(a){return n.grep(n.timers,function(b){return a===b.elem}).length};function Lb(a){return n.isWindow(a)?a:9===a.nodeType&&a.defaultView}n.offset={setOffset:function(a,b,c){var d,e,f,g,h,i,j,k=n.css(a,"position"),l=n(a),m={};"static"===k&&(a.style.position="relative"),h=l.offset(),f=n.css(a,"top"),i=n.css(a,"left"),j=("absolute"===k||"fixed"===k)&&(f+i).indexOf("auto")>-1,j?(d=l.position(),g=d.top,e=d.left):(g=parseFloat(f)||0,e=parseFloat(i)||0),n.isFunction(b)&&(b=b.call(a,c,n.extend({},h))),null!=b.top&&(m.top=b.top-h.top+g),null!=b.left&&(m.left=b.left-h.left+e),"using"in b?b.using.call(a,m):l.css(m)}},n.fn.extend({offset:function(a){if(arguments.length)return void 0===a?this:this.each(function(b){n.offset.setOffset(this,a,b)});var b,c,d=this[0],e={top:0,left:0},f=d&&d.ownerDocument;if(f)return b=f.documentElement,n.contains(b,d)?(e=d.getBoundingClientRect(),c=Lb(f),{top:e.top+c.pageYOffset-b.clientTop,left:e.left+c.pageXOffset-b.clientLeft}):e},position:function(){if(this[0]){var a,b,c=this[0],d={top:0,left:0};return"fixed"===n.css(c,"position")?b=c.getBoundingClientRect():(a=this.offsetParent(),b=this.offset(),n.nodeName(a[0],"html")||(d=a.offset()),d.top+=n.css(a[0],"borderTopWidth",!0),d.left+=n.css(a[0],"borderLeftWidth",!0)),{top:b.top-d.top-n.css(c,"marginTop",!0),left:b.left-d.left-n.css(c,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var a=this.offsetParent;while(a&&"static"===n.css(a,"position"))a=a.offsetParent;return a||Ea})}}),n.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(a,b){var c="pageYOffset"===b;n.fn[a]=function(d){return K(this,function(a,d,e){var f=Lb(a);return void 0===e?f?f[b]:a[d]:void(f?f.scrollTo(c?f.pageXOffset:e,c?e:f.pageYOffset):a[d]=e)},a,d,arguments.length)}}),n.each(["top","left"],function(a,b){n.cssHooks[b]=Ga(l.pixelPosition,function(a,c){return c?(c=Fa(a,b),Ba.test(c)?n(a).position()[b]+"px":c):void 0})}),n.each({Height:"height",Width:"width"},function(a,b){n.each({padding:"inner"+a,content:b,"":"outer"+a},function(c,d){n.fn[d]=function(d,e){var f=arguments.length&&(c||"boolean"!=typeof d),g=c||(d===!0||e===!0?"margin":"border");return K(this,function(b,c,d){var e;return n.isWindow(b)?b.document.documentElement["client"+a]:9===b.nodeType?(e=b.documentElement,Math.max(b.body["scroll"+a],e["scroll"+a],b.body["offset"+a],e["offset"+a],e["client"+a])):void 0===d?n.css(b,c,g):n.style(b,c,d,g)},b,f?d:void 0,f,null)}})}),n.fn.extend({bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return 1===arguments.length?this.off(a,"**"):this.off(b,a||"**",c)},size:function(){return this.length}}),n.fn.andSelf=n.fn.addBack,"function"==typeof define&&define.amd&&define("jquery",[],function(){return n});var Mb=a.jQuery,Nb=a.$;return n.noConflict=function(b){return a.$===n&&(a.$=Nb),b&&a.jQuery===n&&(a.jQuery=Mb),n},b||(a.jQuery=a.$=n),n});
/*!
 * imagesLoaded PACKAGED v4.1.0
 * JavaScript is all like "You images are done yet or what?"
 * MIT License
 */


!function(t,e){"function"==typeof define&&define.amd?define("ev-emitter/ev-emitter",e):"object"==typeof module&&module.exports?module.exports=e():t.EvEmitter=e()}(this,function(){function t(){}var e=t.prototype;return e.on=function(t,e){if(t&&e){var i=this._events=this._events||{},n=i[t]=i[t]||[];return-1==n.indexOf(e)&&n.push(e),this}},e.once=function(t,e){if(t&&e){this.on(t,e);var i=this._onceEvents=this._onceEvents||{},n=i[t]=i[t]||[];return n[e]=!0,this}},e.off=function(t,e){var i=this._events&&this._events[t];if(i&&i.length){var n=i.indexOf(e);return-1!=n&&i.splice(n,1),this}},e.emitEvent=function(t,e){var i=this._events&&this._events[t];if(i&&i.length){var n=0,o=i[n];e=e||[];for(var r=this._onceEvents&&this._onceEvents[t];o;){var s=r&&r[o];s&&(this.off(t,o),delete r[o]),o.apply(this,e),n+=s?0:1,o=i[n]}return this}},t}),function(t,e){"use strict";"function"==typeof define&&define.amd?define(["ev-emitter/ev-emitter"],function(i){return e(t,i)}):"object"==typeof module&&module.exports?module.exports=e(t,require("ev-emitter")):t.imagesLoaded=e(t,t.EvEmitter)}(window,function(t,e){function i(t,e){for(var i in e)t[i]=e[i];return t}function n(t){var e=[];if(Array.isArray(t))e=t;else if("number"==typeof t.length)for(var i=0;i<t.length;i++)e.push(t[i]);else e.push(t);return e}function o(t,e,r){return this instanceof o?("string"==typeof t&&(t=document.querySelectorAll(t)),this.elements=n(t),this.options=i({},this.options),"function"==typeof e?r=e:i(this.options,e),r&&this.on("always",r),this.getImages(),h&&(this.jqDeferred=new h.Deferred),void setTimeout(function(){this.check()}.bind(this))):new o(t,e,r)}function r(t){this.img=t}function s(t,e){this.url=t,this.element=e,this.img=new Image}var h=t.jQuery,a=t.console;o.prototype=Object.create(e.prototype),o.prototype.options={},o.prototype.getImages=function(){this.images=[],this.elements.forEach(this.addElementImages,this)},o.prototype.addElementImages=function(t){"IMG"==t.nodeName&&this.addImage(t),this.options.background===!0&&this.addElementBackgroundImages(t);var e=t.nodeType;if(e&&d[e]){for(var i=t.querySelectorAll("img"),n=0;n<i.length;n++){var o=i[n];this.addImage(o)}if("string"==typeof this.options.background){var r=t.querySelectorAll(this.options.background);for(n=0;n<r.length;n++){var s=r[n];this.addElementBackgroundImages(s)}}}};var d={1:!0,9:!0,11:!0};return o.prototype.addElementBackgroundImages=function(t){var e=getComputedStyle(t);if(e)for(var i=/url\((['"])?(.*?)\1\)/gi,n=i.exec(e.backgroundImage);null!==n;){var o=n&&n[2];o&&this.addBackground(o,t),n=i.exec(e.backgroundImage)}},o.prototype.addImage=function(t){var e=new r(t);this.images.push(e)},o.prototype.addBackground=function(t,e){var i=new s(t,e);this.images.push(i)},o.prototype.check=function(){function t(t,i,n){setTimeout(function(){e.progress(t,i,n)})}var e=this;return this.progressedCount=0,this.hasAnyBroken=!1,this.images.length?void this.images.forEach(function(e){e.once("progress",t),e.check()}):void this.complete()},o.prototype.progress=function(t,e,i){this.progressedCount++,this.hasAnyBroken=this.hasAnyBroken||!t.isLoaded,this.emitEvent("progress",[this,t,e]),this.jqDeferred&&this.jqDeferred.notify&&this.jqDeferred.notify(this,t),this.progressedCount==this.images.length&&this.complete(),this.options.debug&&a&&a.log("progress: "+i,t,e)},o.prototype.complete=function(){var t=this.hasAnyBroken?"fail":"done";if(this.isComplete=!0,this.emitEvent(t,[this]),this.emitEvent("always",[this]),this.jqDeferred){var e=this.hasAnyBroken?"reject":"resolve";this.jqDeferred[e](this)}},r.prototype=Object.create(e.prototype),r.prototype.check=function(){var t=this.getIsImageComplete();return t?void this.confirm(0!==this.img.naturalWidth,"naturalWidth"):(this.proxyImage=new Image,this.proxyImage.addEventListener("load",this),this.proxyImage.addEventListener("error",this),this.img.addEventListener("load",this),this.img.addEventListener("error",this),void(this.proxyImage.src=this.img.src))},r.prototype.getIsImageComplete=function(){return this.img.complete&&void 0!==this.img.naturalWidth},r.prototype.confirm=function(t,e){this.isLoaded=t,this.emitEvent("progress",[this,this.img,e])},r.prototype.handleEvent=function(t){var e="on"+t.type;this[e]&&this[e](t)},r.prototype.onload=function(){this.confirm(!0,"onload"),this.unbindEvents()},r.prototype.onerror=function(){this.confirm(!1,"onerror"),this.unbindEvents()},r.prototype.unbindEvents=function(){this.proxyImage.removeEventListener("load",this),this.proxyImage.removeEventListener("error",this),this.img.removeEventListener("load",this),this.img.removeEventListener("error",this)},s.prototype=Object.create(r.prototype),s.prototype.check=function(){this.img.addEventListener("load",this),this.img.addEventListener("error",this),this.img.src=this.url;var t=this.getIsImageComplete();t&&(this.confirm(0!==this.img.naturalWidth,"naturalWidth"),this.unbindEvents())},s.prototype.unbindEvents=function(){this.img.removeEventListener("load",this),this.img.removeEventListener("error",this)},s.prototype.confirm=function(t,e){this.isLoaded=t,this.emitEvent("progress",[this,this.element,e])},o.makeJQueryPlugin=function(e){e=e||t.jQuery,e&&(h=e,h.fn.imagesLoaded=function(t,e){var i=new o(this,t,e);return i.jqDeferred.promise(h(this))})},o.makeJQueryPlugin(),o});





//console.log('ind = ' + individuals);
var M = new Mooog();
M.node(
    { id:'lfo', node_type:'Oscillator', type:'sawtooth', frequency:3 }
  )
	//.start()
  .chain( 
    M.node( {id:'gain', node_type:'Gain', gain:40} )
  )
  .chain(
    M.node({id:'osc', node_type:'Oscillator', frequency:300}), 'frequency'
  )

  .start();


  $(document).ready(function(){

  	$('i').css('top', '100px');
  	startNow();
  	var display = false;


  	$('html').click(function(){
	  	if ( display === true ) {
	  		 //console.log('click : '  + display);
			  	M.node('osc').start();
          display = false;
          //console.log('click 2 : '  + display);
			   //return;
			} else if ( display === false ) {
				//console.log('click : '  + display);
			   
			    M.node('osc').stop();
			   display = true;
			   //return;
			}
  	});


  });
  
  function startNow(){
	  
	  (function(){

	  var indCounter=0,
	  imgCounter = 0,
	  zIndexCounter = 53;

	  var homelessImg = 53,
	  homelessImgCounter = 0;
	  	console.log(homelessImg);

      function loadImages(){
      	for (var i = homelessImg - 1; i >= 0; i--) {
      	  homelessImgCounter++;
      	  
      	  // if (homelessImgCounter < 10) {
      	 	// 	$('#screen').append( '<img class="dataImage" id="dataImagea'+homelessImgCounter+'" src="/img/couch/mc_0'+homelessImgCounter+'.jpg" />' );
      	 	// } else if (homelessImgCounter >= 10 && homelessImgCounter < 38 ) {
      	 	// 	$('#screen').append( '<img class="dataImage" id="dataImagea'+homelessImgCounter+'" src="/img/couch/mc_'+homelessImgCounter+'.jpg" />' );
      	 	// }
      	 	$('#screen').append( '<img class="dataImage" id="dataImagea'+homelessImgCounter+'" src="/img/a'+homelessImgCounter+'.jpg" />' );
      	 	//$('#screen').append( 'a');
      	 //	console.log(homelessImgCounter);
      	 	
      	};


      };

      //loadImages();  

      $('body').imagesLoaded()
		  .always( function( instance ) {
		    // console.log('all images loaded');
		  })
		  .done( function( instance ) {
		  	console.log('all images are loaded');
      	setInterval(moveDot, 250);
		  })
		  .fail( function() {
		    // console.log('all images loaded, at least one is broken');
		  })
		  .progress( function( instance, image ) {
		    var result = image.isLoaded ? 'loaded' : 'broken';
		    // console.log( 'image is ' + result + ' for ' + image.img.src );
		  });


      //log.entries.response.content.text

      // <img id='base64image' src='data:image/jpeg;base64, <!-- base64 data -->'/>
	  	


			function moveDot() {
			  // Your code here
			  //console.log('moveDot');
			  var individual =  individuals[indCounter],
			  freqVal = individual-58000,
			  visVal = freqVal, 
			  counterVal = visVal+20;

			  
			   

			  indCounter += 1;
			  zIndexCounter -=1; 
			  imgCounter += 1;
	  	  
			  M.node('osc').param("frequency",freqVal);
			  //console.log('freq '+freqVal+ ' curtime '+M.context.currentTime);
			  // $('i.tracker').css('top', visVal + 'px');
			  // $('i.tracker').css('left', indCounter + 'px');
			  // $('i.tracker').css('border-width', visVal/5 + 'px');
			  // $('i.tracker').css('border-radius', visVal/5 + 'px');
			  // $( '.container' ).append( '<i style="top:' + visVal + 'px; left:' + indCounter*10 + 'px; border-width:' +  visVal/5 + 'px;border-radius:' + visVal/5 + 'px;"></i>' );
			  // $( '.container' ).append( '<div class="counter" style="top:' + visVal  + 'px; left:' + indCounter + 'px;">'+freqVal+'</div>' );
			  

			  if ( imgCounter <= 53 ) {
			  //if ( imgCounter <= 37 ) {

			  	$('#dataImagea' + imgCounter).css('z-index', zIndexCounter + 1000 );
			  	//console.log('#dataImagea' + (imgCounter));
			  } else {
			  	imgCounter = 0;
			  }
			  
			} 
			console.log('int'); 
			 
			

		})()
 
  }

  
;
