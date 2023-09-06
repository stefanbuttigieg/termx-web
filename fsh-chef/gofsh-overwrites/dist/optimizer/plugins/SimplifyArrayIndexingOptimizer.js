"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFSHPath = void 0;
const fsh_sushi_1 = require("fsh-sushi");
const exportable_1 = require("../../exportable");
const lodash_1 = __importDefault(require("lodash"));
exports.default = {
    name: 'simplify_array_indexing',
    description: 'Replace numeric indices with soft indexing',
    runAfter: [new RegExp(/(add|combine|construct|remove|resolve).*/)],
    optimize(pkg) {
        // If there is only a single element in an array, include no indices at all
        // If there is more than one element in an array, reference the first element with
        // a '0' and subsequent elements with soft indexing
        [
            ...pkg.profiles,
            ...pkg.extensions,
            ...pkg.logicals,
            ...pkg.resources,
            ...pkg.valueSets,
            ...pkg.codeSystems,
            ...pkg.instances,
            ...pkg.mappings
        ].forEach(def => {
            const pathMap = new Map();
            const caretPathMap = new Map();
            const ruleArr = def.rules;
            const parsedPaths = ruleArr.map((rule) => {
                const parsedPath = {
                    path: parseFSHPath(rule.path),
                    caretPath: []
                };
                // If we have a CaretValueRule, we'll need a second round of parsing for the caret path
                if (rule instanceof exportable_1.ExportableCaretValueRule) {
                    parsedPath.caretPath = parseFSHPath(rule.caretPath);
                }
                return parsedPath;
            });
            parsedPaths.forEach(rule => {
                addPrefixes(rule.path);
                if (rule.caretPath) {
                    addPrefixes(rule.caretPath);
                }
            });
            parsedPaths.forEach((parsedRule, ruleIndex) => {
                const originalRule = def.rules[ruleIndex];
                parsedRule.path.forEach((element) => {
                    applySoftIndexing(element, pathMap);
                });
                parsedRule.caretPath.forEach((element) => {
                    // Caret path indexes should only be resolved in the context of a specific path
                    // Each normal path has a separate map to keep track of the caret path indexes
                    if (!caretPathMap.has(originalRule.path)) {
                        caretPathMap.set(originalRule.path, new Map());
                    }
                    const elementCaretPathMap = caretPathMap.get(originalRule.path);
                    applySoftIndexing(element, elementCaretPathMap);
                });
            });
            removeZeroIndices(parsedPaths);
            parsedPaths.forEach((parsedRule, ruleIndex) => {
                const originalRule = def.rules[ruleIndex];
                originalRule.path = fsh_sushi_1.utils.assembleFSHPath(parsedRule.path);
                if (originalRule instanceof exportable_1.ExportableCaretValueRule) {
                    originalRule.caretPath = fsh_sushi_1.utils.assembleFSHPath(parsedRule.caretPath);
                }
            });
        });
    }
};
/**
 * Populates each PathPart in an array of PathParts with a prefix containing the assembled path up to that element
 * @param { path: PathPart[] } parsedPath - An array of PathParts
 */
function addPrefixes(parsedPath) {
    parsedPath.forEach((element, elementIndex) => {
        // Add a prefix to the current element containing previously parsed rule elements
        element.prefix = fsh_sushi_1.utils.assembleFSHPath(parsedPath.slice(0, elementIndex));
    });
}
/**
 * Converts numeric indeces on a PathPart into soft indexing characters
 * @param {PathPart} element - A single element in a rules path
 * @param {Map<string, number} pathMap - A map containing an element's name as the key and that element's updated index as the value
 * @param {Map<string, PathPart[]} singletonArrayElements - A map containing a string unique to each element of type array as the key, and an array of PathParts as the value
 */
function applySoftIndexing(element, pathMap) {
    var _a, _b, _c;
    // Must account for a pathPart's base name, prior portions of the path, as well as any slices it's contained in.
    const mapName = `${(_a = element.prefix) !== null && _a !== void 0 ? _a : ''}.${element.base}|${((_b = element.slices) !== null && _b !== void 0 ? _b : []).join('|')}`;
    const indexRegex = /^[0-9]+$/;
    const currentNumericBracket = (_c = element.brackets) === null || _c === void 0 ? void 0 : _c.find(bracket => indexRegex.test(bracket));
    if (!currentNumericBracket)
        return; // If the element is not an array, exit the function
    const bracketIndex = element.brackets.indexOf(currentNumericBracket);
    if (!pathMap.has(mapName)) {
        pathMap.set(mapName, parseInt(currentNumericBracket));
    }
    else {
        const previousNumericIndex = pathMap.get(mapName);
        if (parseInt(currentNumericBracket) === previousNumericIndex + 1) {
            element.brackets[bracketIndex] = '+';
            pathMap.set(mapName, previousNumericIndex + 1);
        }
        else if (parseInt(currentNumericBracket) === previousNumericIndex) {
            element.brackets[bracketIndex] = '=';
        }
        else {
            pathMap.set(mapName, parseInt(currentNumericBracket));
        }
    }
}
// TODO: remove once sushi has been released with fixes to the parseFSHPath function
function splitOnPathPeriods(path) {
    return path.split(/\.(?![^\[]*\])/g); // match a period that isn't within square brackets
}
// TODO: remove once sushi has been released with fixes to the parseFSHPath function
function parseFSHPath(fshPath) {
    const pathParts = [];
    const seenSlices = [];
    const indexRegex = /^[0-9]+$/;
    const splitPath = fshPath === '.' ? [fshPath] : splitOnPathPeriods(fshPath);
    for (const pathPart of splitPath) {
        const splitPathPart = pathPart.split('[');
        if (splitPathPart.length === 1 || pathPart.endsWith('[x]')) {
            // There are no brackets, or the brackets are for a choice, so just push on the name
            pathParts.push({ base: pathPart });
        }
        else {
            // We have brackets, let's  save the bracket info
            let fhirPathBase = splitPathPart[0];
            // Get the bracket elements and slice off the trailing ']'
            let brackets = splitPathPart.slice(1).map(s => s.slice(0, -1));
            // Get rid of any remaining [x] elements in the brackets
            if (brackets[0] === 'x') {
                fhirPathBase += '[x]';
                brackets = brackets.slice(1);
            }
            brackets.forEach(bracket => {
                if (!indexRegex.test(bracket) && !(bracket === '+' || bracket === '=')) {
                    seenSlices.push(bracket);
                }
            });
            if (seenSlices.length > 0) {
                pathParts.push({
                    base: fhirPathBase,
                    brackets: brackets,
                    slices: [...seenSlices]
                });
            }
            else {
                pathParts.push({ base: fhirPathBase, brackets: brackets });
            }
        }
    }
    return pathParts;
}
exports.parseFSHPath = parseFSHPath;
// Removes '[0]' and '[=]' indexing from elements with a single value in their array
function removeZeroIndices(parsedPaths) {
    const regularPathElements = lodash_1.default.flatten(parsedPaths.map(rule => rule.path));
    const caretPathElements = lodash_1.default.flatten(parsedPaths.map(rule => rule.caretPath));
    const referencePathElements = lodash_1.default.cloneDeep(regularPathElements);
    const referenceCaretPathElements = lodash_1.default.cloneDeep(caretPathElements);
    regularPathElements.forEach((element) => {
        if (!element.brackets) {
            return;
        }
        const filteredElements = referencePathElements.filter(e => e.base === element.base &&
          e.prefix === element.prefix &&
          e.brackets &&
          !(e.brackets.includes('0') || e.brackets.includes('=')));
        if (filteredElements.length === 0) {
            if (element.brackets.includes('0')) {
                const zeroIndex = element.brackets.indexOf('0');
                delete element.brackets[zeroIndex];
            }
            if (element.brackets.includes('=')) {
                const equalsIndex = element.brackets.indexOf('=');
                delete element.brackets[equalsIndex];
            }
        }
    });
    caretPathElements.forEach((element) => {
        if (!element.brackets) {
            return;
        }
        const hasOther = referenceCaretPathElements.some(e => e.base === element.base &&
          e.prefix === element.prefix &&
          e.brackets &&
          !(e.brackets.includes('0') || e.brackets.includes('=')));
        if (!hasOther) {
            if (element.brackets.includes('0')) {
                const zeroIndex = element.brackets.indexOf('0');
                delete element.brackets[zeroIndex];
            }
            if (element.brackets.includes('=')) {
                const equalsIndex = element.brackets.indexOf('=');
                delete element.brackets[equalsIndex];
            }
        }
    });
}
//# sourceMappingURL=SimplifyArrayIndexingOptimizer.js.map
