;
(function() {
    var root = this;
    var lodash = root._;
    var ramda = {};

    /*--------------------------------------------------------------------------*/
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = ramda;
        }
        exports.ramda = ramda;
        lodash = require('lodash');
    } else {
        root.ramda = ramda;
    }

    /**
     * Reverse the first *N* args on a function allowing for different calling syntax
     * For instance
     *
     * internalFlipArgs(function() {
     *     console.log(arguments);
     *  }, 3, -1)(1, 2, 'a', 'b', 'c') // => logs 'a', 2, 1, 'b', 'c'
     *
     */
    function internalFlipArgs(func, firstNArgs, numFnArgs, takesContext) {
        firstNArgs = Math.max(firstNArgs, 0);
        if (!lodash.isNumber(numFnArgs)) numFnArgs = -1;
        return function() {
            var context = this;
            var numArgs = numFnArgs >= 0 ? numFnArgs : arguments.length;
            var args = Array(numArgs);
            var start = Math.min(numArgs, firstNArgs);
            for (var index = 0; index < numArgs; index++) {
                // Reverse the first *N* args then concats the rest
                args[index] = start > 0 ? arguments[--start] : arguments[index];
            }

            switch ((takesContext || (context != null && context != root)) && numArgs) {
                case 1: return func(args[0]);
                case 2: return func(args[0], args[1]);
                case 3: return func(args[0], args[1], args[2]);
                case 4: return func(args[0], args[1], args[2], args[3]);
            }
            return func.apply(context, args);
        };
    }

    // wrapper function b/c ramda doesn't want to call with idx?
    function createArgLimiter(fn, args) {
        if (!lodash.isNumber(args)) return fn;
        switch (args) {
            case 1: return function(x1) {
                return fn(x1);
            };
            case 2: return function(x1, x2) {
                return fn(x1, x2);
            };
        }
        return function() {
            return fn.apply(null, arguments);
        };
    }

    ramda.flip = function(fn) {
        return lodash.curry(internalFlipArgs(fn, 2, -1, false), fn.length);
    };

    function flipCurry(method, args) {
        return lodash.curry(internalFlipArgs(lodash[method], args.reverseArgs, args.numArgs, true), args.minArgs);
    }

    // Curry em all up
    function ramify(method) {
        ramda[method] = flipCurry(method, this);
    }

    function alias(alias, method) {
        ramda[alias] = ramda[method];
    }

    function lalias(alias, method, curryArgs) {
        ramda[alias] = curryArgs ? lodash.curry(lodash[method], curryArgs) : lodash[method];
    }

    var twoArgs = {
        reverseArgs: 2,
        numArgs: 2,
        minArgs: 2
    };
    lodash.each(['contains', 'countBy', 'drop', 'find', 'findIndex', 'findLastIndex', 'groupBy', 'pluck', 'pick',
                'omit', 'sortBy', 'take', 'takeWhile'], ramify, twoArgs);

    lodash.each(['any', 'all', 'each', 'filter', 'map', 'mapValues', 'reject'], function(type) {
        function iter(args) {
            return lodash.curry(function(fn, list) {
                return lodash[type](list, createArgLimiter(fn, args));
            });
        }
        ramda[type] = iter(1);
        ramda[type].idx = iter();
    });

    lodash.each(['foldl', 'foldr'], function(type) {
        function fold(args) {
            return lodash.curry(function(fn, acc, list) {
                return lodash[type](list, createArgLimiter(fn, args), acc);
            });
        }
        ramda[type] = fold(2);
        ramda[type].idx = fold(4);
    });

    ramda.unfoldr = lodash.curry(function(fn, seed) {
        var pair = fn(seed), result = [];
        while (pair && pair.length) {
            result.push(pair[0]);
            pair = fn(pair[1]);
        }
        return result;
    });

    lodash.each(['clone', 'compose', 'curry', 'head', 'keys', 'identity', 'isEmpty',
                'last', 'max', 'min', 'once',
                'size', 'tail', 'union', 'uniq', 'values', 'wrap'
            ], function(method) {
        ramda[method] = lodash[method];
    });

    function itemFindWrap(method) {
        return lodash.curry(function(fn, list) {
            if (lodash.isEmpty(list)) return void 0;
            return method(list, fn);
        });
    }

    ramda.maxWith = itemFindWrap(lodash.max);
    ramda.minWith = itemFindWrap(lodash.min);

    ramda.pipe = function() {
        return lodash.compose.apply(null, lodash.slice(arguments).reverse());
    };

    function predicateWrap(pickFunction) {
        return lodash.curry(function(preds /* , args */ ) {
            var args = lodash.slice(arguments, 1);
            return pickFunction(preds, function(func) {
                return func.apply(null, args);
            });
        }, 2);
    }

    ramda.allPredicates = predicateWrap(lodash.all);
    ramda.anyPredicates = predicateWrap(lodash.any);

    function mkArgStr(n) {
        return lodash.times(n, function(i) {
           return 'a' + i;
        }).join(',');
    }

    ramda.nAry = (function() {
        var makeN = lodash.memoize(function(n) {
            var fnArgs = mkArgStr(n);
            var body = [
                'return function(' + fnArgs + ') {',
                'return func.call(this' + (n ? ', ' + fnArgs : '') + ');',
                '}'
            ].join('');
            return new Function('func', body);
        });

        return function(n, fn) {
            return (makeN(n))(fn);
        };
    }());

    ramda.arity = (function() {
        var makeN = lodash.memoize(function(n) {
            var fnArgs = mkArgStr(n);
            var body = [
                'return function(' + fnArgs + ') {',
                'return func.apply(this, arguments);',
                '}'
            ].join('');
            return new Function('func', body);
        });

        return function(n, fn) {
            return (makeN(n))(fn);
        };
    }());

    ramda.memoize = function(fn) {
        return lodash.memoize(fn, function() {
            return lodash.last(arguments);
        });
    };

    ramda.where = lodash.curry(function(spec, object) {
        return lodash.matches(lodash.omit(spec, lodash.isFunction))(object) && lodash.every(spec, function(item, key) {
            return !lodash.isFunction(item) || item(object[key], object);
        });
    });

    //misc
    ramda.prepend = function(el, list) {
        return [el].concat(list);
    };
    ramda.append = function(el, list) {
        return list.concat([el]);
    };
    ramda.merge = lodash.curry(function(x, y) {
        return lodash.slice(x).concat(y);
    });
    ramda.splice = lodash.curry(function(start, len, list) {
        return lodash.slice(list, 0, start).concat(lodash.slice(list, start + len));
    });

    ramda.flatten = function(list) {
        return lodash.flatten(list, true);
    };

    ramda.isAtom = function(x) {
        return x != null && !lodash.isArray(x);
    };

    ramda.comparator = function(pred) {
        return function(a, b) {
            return pred(a, b) ? -1 : pred(b, a) ? 1 : 0;
        };
    };
    ramda.sort = lodash.curry(function(comparitor, list) {
        return lodash.slice(list).sort(comparitor);
    });
    ramda.range = lodash.curry(lodash.range, 2);

    ramda.reverse = function(list) {
        return lodash.toArray(list).reverse();
    };

    function createChooser(method) {
        return lodash.curry(function(/* funcs */) {
            var funcs = arguments;
            return function(/* funcs */) {
                var args = arguments, context = this;
                return method(funcs, function(func) {
                    return func.apply(context, args);
                });
            };
        }, 2);
    }
    ramda.or = createChooser(lodash.any);
    ramda.and = createChooser(lodash.all);
    ramda.anyBlanks = function() {
        return lodash.any(function(x) {
            return x == null;
        });
    };

    ramda.repeatN = lodash.curry(function(value, n) {
        return lodash.times(n, lodash.constant(value));
    });

    ramda.nth = lodash.curry(function(idx, list) {
        return list && list[idx];
    });

    ramda.prop = lodash.curry(function(prop, obj) {
        return obj && obj[prop];
    });
    ramda.props = lodash.curry(function(obj, prop) {
        return obj && obj[prop];
    });

    ramda.func = lodash.curry(function(key, obj) {
        return obj[key].apply(obj, lodash.slice(arguments, 2));
    });

    ramda.fork = function(parent) {
        var funcs = lodash.slice(arguments, 1);
        return function() {
            var args = arguments;
            return parent.apply(null, lodash.map(funcs, function(func) {
                return func.apply(null, args);
            }));
        };
    };

    ramda.useWith = function(fn /*, transformers*/) {
        var transformers = lodash.slice(arguments, 1),
            tlen = transformers.length;
        return lodash.curry(function() {
            var args = arguments,
                rest = lodash.slice(args, tlen);
            return fn.apply(this, lodash.map(transformers, function(transformer, idx) {
                return transformer(args[idx]);
            }).concat(rest));
        }, tlen);
    };

    ramda.use = function(fn) {
        return {
            over: function(/*transformers*/) {
                return ramda.useWith.apply(this, [fn].concat(lodash.slice(arguments)));
            }
        };
    };

    ramda.pickAll = lodash.curry(function(names, obj) {
        return lodash.reduce(names, function(memo, name) {
            memo[name] = obj[name];
            return memo;
        }, {});
    });

    ramda.project = ramda.useWith(ramda.map, ramda.pickAll);

    // ramda.intersection = lodash.curry(lodash.intersection, 2);
    lalias('intersection', 'intersection', 2);
    ramda.difference = lodash.curry(function() {
        return lodash.uniq(lodash.difference.apply(null, arguments));
    }, 2);

    //https://github.com/megawac/lodash/commit/2b0dd824256814b40606d39a291c6b8c7bc0a696#commitcomment-6758535
    function zip(list1) {
        if (list1 == null) return [];
        var length = lodash.min(arguments, 'length').length;
        return lodash.zip.apply(this, lodash.map(arguments, function(array) {
            return lodash.slice(array, 0, length);
        }));
    }

    ramda.zip = lodash.curry(zip);

    // internal path function
    function path(paths, obj) {
        var i = -1, length = paths.length, val;
        while (obj != null && ++i < length) {
            obj = val = obj[paths[i]];
        }
        return val;
    }
    ramda.pathWith = lodash.curry(function(fn, str, obj) {
        var paths = fn(str) || [];
        return path(paths, obj);
    });
    ramda.pathBy = lodash.curry(function(sep, str, obj) {
        return path(str.split(sep), obj);
    });
    ramda.path = ramda.pathBy('.');
    
    // with functions...

    function containsWith(predicate, item, list) {
        return lodash.any(list, function(x) {
            return predicate(item, x);
        });
    }
    function uniqWith(predicate, list) {
        return lodash.reduce(list, function(memo, x) {
            return containsWith(predicate, x, memo) ? memo : memo.concat([x]);
        }, []);
    }
    ramda.containsWith = lodash.curry(containsWith);

    ramda.intersectionWith = lodash.curry(function(predicate, list1, list2) {
        return uniqWith(predicate, lodash.filter(list1, function(item) {
            return containsWith(predicate, item, list2);
        }));
    });

    ramda.differenceWith = lodash.curry(function(predicate, list1, list2) {
        return uniqWith(predicate, lodash.filter(list1, function(item) {
            return !containsWith(predicate, item, list2);
        }));
    });

    ramda.unionWith = lodash.curry(function(predicate, list1, list2) {
        return uniqWith(predicate, list1.concat(list2));
    });

    ramda.zipWith = lodash.curry(function(fn /*lists*/) {
        var args = zip.apply(null, lodash.slice(arguments, 1));
        return lodash.map(args, function(items) {
            return fn.apply(null, items);
        });
    });

    ramda.xprodWith = lodash.curry(function(fn, list1, list2) {
        var i = 0, ilen = list1.length,
            j, jlen = list2.length,
            result = [];
        if (!ilen || !jlen) return result;
        for (; i < ilen; i++) {
            for (j = 0; j < jlen; j++) {
                result.push(fn(list1[i], list2[j]));
            }
        }
        return result;
        // return lodash.reduce(list1, function(memo, mark) {
        //     return memo.concat(lodash.map(b, function(val) {
        //         return fn(mark, val);
        //     }));
        // }, []);
    });

    ramda.xprod = ramda.xprodWith(function(val1, val2) {
        return [val1, val2];
    });

    ramda.construct = function(Fn) {
        function constructor() {
            var context = new Fn();
            Fn.apply(context, arguments);
            return context;
        }
        return lodash.curry(constructor, Fn.length);
    };

    ramda.skipUntil = lodash.curry(function(fn, list) {
        var idx = -1, len = list.length;
        while (++idx < len && !fn(list[idx])) {}
        return lodash.slice(list, idx);
    });

    ramda.tap = lodash.curry(function(set, fn) {
        if (lodash.isFunction(fn)) fn(set);
        return set;
    });

    ramda.isSet = function(list) {
        return !lodash.any(list, function(item, idx) {
            return lodash.contains(list, item, idx + 1);
        });
    };

    ramda.alwaysZero = lodash.constant(0);
    ramda.alwaysFalse = lodash.constant(false);
    ramda.alwaysTrue = lodash.constant(true);
    ramda.alwaysTrue = lodash.constant(true);

    // Arithmetic Functions
    ramda.add = lodash.curry(function(a, b) {return a + b;});
    ramda.multiply = lodash.curry(function(a, b) {return a * b;});
    ramda.subtract = lodash.curry(function(a, b) {return a - b;});
    ramda.subtractN = lodash.curry(function(a, b) {return b - a;});
    ramda.divide = lodash.curry(function(a, b) {return a / b;});
    ramda.divideBy = lodash.curry(function(a, b) {return b / a;});
    ramda.modulo = lodash.curry(function(a, b) { return a % b; });
    ramda.moduloBy = lodash.curry(function(a, b) {return b % a;});
    ramda.sum = ramda.foldl(ramda.add, 0);
    ramda.product = ramda.foldl(ramda.multiply, 1);
    ramda.lt = lodash.curry(function(a, b) {return a < b;});
    ramda.lte = lodash.curry(function(a, b) {return a <= b;});
    ramda.gt = lodash.curry(function(a, b) {return a > b;});
    ramda.gte = lodash.curry(function(a, b) {return a >= b;});

    ramda.eq = lodash.curry(function(a, b) {return a === b;});
    ramda.eqProps = lodash.curry(function(prop, obj1, obj2) {
        return obj1[prop] === obj2[prop];
    });
    ramda.propEq = lodash.curry(function(name, val, obj) {
        return obj[name] === val;
    });

    ramda.installTo = function(obj) {
        lodash.extend(obj || root, ramda);
    };


    // Proto sharers

    // Turns a named method of an object (or object prototype) into a function that can be called directly.
    // The object becomes the last parameter to the function, and the function is automatically curried.
    // Passing the optional `len` parameter restricts the function to the initial `len` parameters of the method.
    function invoker(name, obj, len) {
        var method = obj[name];
        var length = lodash.isNumber(len) ? len : method.length + 1;
        return lodash.curry(function() {
            var endArgs = arguments.length - 1;
            if(endArgs >= 0) {
                var target = arguments[endArgs];
                var targetMethod = target[name];
                if (targetMethod == method) {
                    return targetMethod.apply(target, lodash.slice(arguments, 0, endArgs));
                }
            }
        }, length);
    }

    ramda.invoker = invoker;

    //these methods use the invoker in ramda source leading to odd implementations
    ramda.join = invoker('join', Array.prototype);

    lodash.each(['indexOf', 'lastIndexOf', 'slice'], function(name) {
        var method = lodash[name];
        ramda[name] = lodash.curry(function(a, b, c) {
            if (arguments.length < 3) {
                return method(b, a);
            }
            return method(c, a, b);
        }, 2);
    });

    // ramda.slice = lodash.curry(function(start, end, list) {
    //     return lodash.slice(list, start, end);
    // });
    ramda.slice.from = ramda.slice;

    // String Functions

    ramda.substring = ramda.substringFrom = invoker('slice', String.prototype);
    ramda.substringTo = ramda.substring(0);
    ramda.substringFrom = lodash.curry(function(start, str) {
        return str.slice(start);
    });
    ramda.charAt = invoker('charAt', String.prototype);
    ramda.charCodeAt = invoker('charCodeAt', String.prototype);
    ramda.match = invoker('match', String.prototype);
    ramda.strIndexOf = invoker('indexOf', String.prototype);
    ramda.strLastIndexOf = invoker('lastIndexOf', String.prototype);
    ramda.toUpperCase = invoker('toUpperCase', String.prototype);
    ramda.toLowerCase = invoker('toLowerCase', String.prototype);
    ramda.split = invoker('split', String.prototype, 2);

    lalias('always', 'constant');
    lalias('not', 'negate');
    lalias('mixin', 'extend', 2);
    lalias('lPartial', 'partial');
    lalias('rPartial', 'partialRight');

    alias('get', 'prop');
    alias('forEach', 'each');
    alias('reduce', 'foldl');
    alias('reduceRight', 'foldr');
    alias('every', 'all');
    alias('some', 'any');
    alias('concat', 'merge');
    alias('I', 'identity');
    alias('K', 'tap');
    alias('partition', 'groupBy');
    alias('mapObj', 'mapValues');
    alias('skip', 'drop');
    alias('applyLeft', 'lPartial');
    alias('applyRight', 'rPartial');
}.call(this));