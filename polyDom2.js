
 var instructions = [];
 var dynamicEvents = [];
 var eventId = 0;
function createDynamicObject() {
    var nodeId = 1;
    var localMemory = [];
    var root;
    function escape(obj, parent) {
            if (obj && obj._obj) {
            if (obj._obj.get !== 0) obj._obj.get--;
                return {
                    isDynamicObj: true,
                    path: obj._obj.path,
                    id: obj._obj.id
                }
            } else if (typeof obj === 'function') {
                dynamicEvents[eventId] = {
                    parent: parent,
                    func: obj
                }
                return {
                    isFunction: true,
                    id: eventId++
                }
            } else {
                return obj;
            }
    }
    
    function applySet() {
      function recurse(obj) {
      if (obj._obj.get) {
            obj._obj.get = 0;
            instructions.push({
                type: 'get',
                id: obj._obj.id,
                path: obj._obj.path
            });
        }
        for (var name in obj._obj.cache) {
            var item = obj._obj.cache[name];
            if (item === undefined) continue;
            if (item.value && item.value._obj) {
                if (item.isChild) {
                    recurse(item.value);
                } else {
                    instructions.push({
                        type: 'set',
                        path: obj._obj.path,
                        name: name,
                        id: obj._obj.id,
                        value: {
                            isDynamicObj: true,
                            path: item.value._obj.path,
                            id: item.value._obj.id
                        }
                    });
                    obj._obj.cache[name] = undefined;
                }
            } else {
                instructions.push({
                    type: 'set',
                    path: obj._obj.path,
                    name: name,
                    id: obj._obj.id,
                    value: escape(item.value, obj)
                });
                obj._obj.cache[name] = undefined;
            }
        }
      }
     localMemory.forEach((obj)=>{
        if (obj) recurse(obj);
     });
    }
    function merge(toMerge, target) {
        for (var name in toMerge._obj.cache) {
        var obj = toMerge._obj.cache[name];
             if (obj && obj.isChild) {
                obj.value._obj.parent = target;
                if (!target._obj.cache[name]) {
                    target._obj.cache[name] = obj;
                    target._obj.cache[name].id = target._obj.id;
                }
                merge(obj.value, target._obj.cache[name])
             }
        }
        toMerge._obj.id = target._obj.id
        toMerge._obj.cache = target._obj.cache
    }
    function createNode(id, path, parent, last, isObject) {
        
        var realObj;
        if (isObject) { // not callable
            realObj = {}
        } else {
            realObj = function () {
                if (realObj._obj.get !== 0) realObj._obj.get--;
                applySet();
                var argOut = [];
                for (var i = 0; i < arguments.length; i++) {
                    var arg = arguments[i];
                    argOut.push(escape(arg, parent))
                }
                var newId = nodeId++;
                var returnObj = createNode(newId, [], false,false);
                localMemory[newId] = returnObj;
                instructions.push({
                    type: 'call',
                    path: realObj._obj.path,
                    args: argOut,
                    id: realObj._obj.id,
                    returnId: newId
                });
                return returnObj;
            }
        }
        
        realObj._obj = {
            cache: {},
            path: path,
            parent: parent,
            name: last,
            id: id,
            get: 0
        }
        
        var out = new Proxy(realObj, {
            get: function (target, name) {
                if (name === '_obj') {
                    return target._obj
                } else if (name === 'applyActions') {
                    return function(call) {
                    applySet();
                    }
                } else {
                    var nodeOut;
                    if (target._obj.cache[name]) {
                        nodeOut = target._obj.cache[name].value;
                    } else {
                        var newPath = target._obj.path.slice(0);
                        newPath.push(name)
                        nodeOut = createNode(target._obj.id, newPath, out, name, target._obj.instruction);
                        
                        target._obj.cache[name] = {
                            isChild: true,
                            value: nodeOut
                        }
                    }
                    if (nodeOut && nodeOut._obj)
                    nodeOut._obj.get++;
                    if (target._obj.get !== 0) target._obj.get--;
                    return nodeOut;
                }
            },
            set: function (target, name, value) {
                if (target._obj.get !== 0) target._obj.get--;
                var cacheItem = target._obj.cache[name]
                if (cacheItem && cacheItem.value._obj && cacheItem.value._obj.get !== 0) {
                    instructions.push({
                        type: 'get',
                        id: cacheItem.value._obj.id,
                        path: cacheItem.value._obj.path
                    });
                    cacheItem.value._obj.get = 0;
                }
                target._obj.cache[name] = {
                    isChild: false,
                    value: value
                }
                if (value && value._obj && value._obj.get !== 0) value._obj.get--;
            }
        });
        return out;
    }
    root = createNode(0, [], false,false)
    
    localMemory[0] = root;
    return root;
}

var d = createDynamicObject();

d.hello.bye;
d.hello.bye = d.bye.hello
d.hello.bye.lol;
d.applyActions()
console.log(instructions, d)
