"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fsh_sushi_1 = require("fsh-sushi");
const lodash_1 = require("lodash");
const utils_1 = require("../utils");
const exportable_1 = require("../../exportable");
const { FshCode, FshQuantity } = fsh_sushi_1.fshtypes;
const OPTIMIZABLE_TYPES = [
    'code',
    'Coding',
    'CodeableConcept',
    'Quantity',
    'Age',
    'Distance',
    'Duration',
    'Count'
];
const CODE_IMPOSTER_PATHS = [
    /^concept(\[[^\]]+\])?(\.concept(\[[^\]]+\])?)*$/,
    /^group(\[[^\]]+\])?\.element(\[[^\]]+\])?(\.target(\[[^\]]+\])?)?$/,
    /^group(\[[^\]]+\])?\.unmapped$/,
    /^compose\.(include|exclude)(\[[^\]]+\])?\.concept(\[[^\]]+\])?$/,
    /^expansion(\.contains(\[[^\]]+\])?)+$/ // from ValueSet
];
exports.default = {
    name: 'combine_coding_and_quantity_values',
    description: 'Combine separate caret and assignment rules that together form a Coding or Quantity value',
    optimize(pkg, fisher) {
        if(true) return;
        // Coding has: code, system, display
        // Quantity has: code, system, unit, value
        // If "value" is present, the rule should use a FshQuantity.
        // Otherwise, the rule should keep its FshCode.
        // Profiles and Extensions may have relevant caret rules
        // Instances may have relevant assignment rules
        // It is not necessary to check assignment rules on Profiles and Extensions. Codings and Quantities that
        // are present on Profile and Extension elements are extracted as a single assignment rule, because they are represented as
        // a whole element (patternCoding, fixedQuantity, etc.) rather than a collection of parts.
        [...pkg.profiles, ...pkg.extensions, ...pkg.valueSets, ...pkg.codeSystems].forEach(def => {
            const rulesToRemove = [];
            const rules = def.rules; // <-- this assignment makes TypeScript happier in the next chunk of code
            const typeCache = new Map();
            rules.forEach(rule => {
                if (rule instanceof exportable_1.ExportableCaretValueRule &&
                    rule.caretPath.endsWith('.code') &&
                    rule.value instanceof FshCode) {
                    const basePath = rule.caretPath.replace(/\.code$/, '');
                    const normalizedPath = basePath.replace(/\[[^\]]+\]/g, '');
                    let types;
                    if (typeCache.has(normalizedPath)) {
                        types = typeCache.get(normalizedPath);
                    }
                    else {
                        types = (0, utils_1.getTypesForCaretPath)(def, rule.path, basePath, fisher);
                        typeCache.set(normalizedPath, types);
                    }
                    if (types && !types.some(t => OPTIMIZABLE_TYPES.indexOf(t.code) >= 0)) {
                        return;
                    }
                    const siblingPaths = [
                        `${basePath}.system`,
                        `${basePath}.display`,
                        `${basePath}.unit`,
                        `${basePath}.value`
                    ];
                    const siblings = rules.filter(otherRule => otherRule instanceof exportable_1.ExportableCaretValueRule &&
                        rule.path === otherRule.path &&
                        siblingPaths.includes(otherRule.caretPath));
                    if (siblings.length) {
                        const systemSibling = siblings.find(sibling => sibling.caretPath.endsWith('.system'));
                        const displaySibling = siblings.find(sibling => sibling.caretPath.endsWith('.display'));
                        const unitSibling = siblings.find(sibling => sibling.caretPath.endsWith('.unit'));
                        const valueSibling = siblings.find(sibling => sibling.caretPath.endsWith('.value'));
                        rule.caretPath = basePath;
                        if (valueSibling) {
                            rule.value = new FshQuantity(valueSibling.value, new FshCode(rule.value.code));
                            rulesToRemove.push(rules.indexOf(valueSibling));
                            if (systemSibling) {
                                rule.value.unit.system = systemSibling.value.toString();
                                rulesToRemove.push(rules.indexOf(systemSibling));
                            }
                            if (unitSibling) {
                                rule.value.unit.display = unitSibling.value.toString();
                                rulesToRemove.push(rules.indexOf(unitSibling));
                            }
                        }
                        else {
                            if (systemSibling) {
                                rule.value.system = systemSibling.value.toString();
                                rulesToRemove.push(rules.indexOf(systemSibling));
                            }
                            if (displaySibling || unitSibling) {
                                const displaySource = displaySibling || unitSibling;
                                rule.value.display = displaySource.value.toString();
                                rulesToRemove.push(rules.indexOf(displaySource));
                            }
                            moveUpCaretValueRule(rule, def, siblings);
                        }
                    }
                }
            });
            (0, lodash_1.pullAt)(rules, rulesToRemove);
        });
        const typeCache = new Map();
        pkg.instances.forEach(instance => {
            const rulesToRemove = [];
            if (!typeCache.has(instance.instanceOf)) {
                typeCache.set(instance.instanceOf, new Map());
            }
            const instanceTypeCache = typeCache.get(instance.instanceOf);
            instance.rules.forEach(rule => {
                if (rule instanceof exportable_1.ExportableAssignmentRule &&
                    rule.path.endsWith('.code') &&
                    rule.value instanceof FshCode) {
                    const basePath = rule.path.replace(/\.code$/, '');
                    const normalizedPath = basePath.replace(/\[[^\]]+\]/g, '');
                    let types;
                    if (instanceTypeCache.has(normalizedPath)) {
                        types = instanceTypeCache.get(normalizedPath);
                    }
                    else {
                        types = (0, utils_1.getTypesForInstancePath)(instance, basePath, fisher);
                        instanceTypeCache.set(normalizedPath, types);
                    }
                    if (types && !types.some(t => OPTIMIZABLE_TYPES.indexOf(t.code) >= 0)) {
                        return;
                    }
                    // types might be null if it's an instance of a profile that the fisher couldn't find.
                    // In this case, just to be safe, don't optimize known bad paths!
                    else if (types == null && CODE_IMPOSTER_PATHS.some(cip => cip.test(basePath))) {
                        return;
                    }
                    const siblingPaths = [
                        `${basePath}.system`,
                        `${basePath}.display`,
                        `${basePath}.unit`,
                        `${basePath}.value`
                    ];
                    const siblings = instance.rules.filter(otherRule => otherRule instanceof exportable_1.ExportableAssignmentRule && siblingPaths.includes(otherRule.path));
                    if (siblings.length) {
                        const systemSibling = siblings.find(sibling => sibling.path.endsWith('.system'));
                        const displaySibling = siblings.find(sibling => sibling.path.endsWith('.display'));
                        const unitSibling = siblings.find(sibling => sibling.path.endsWith('.unit'));
                        const valueSibling = siblings.find(sibling => sibling.path.endsWith('.value'));
                        rule.path = basePath;
                        if (valueSibling) {
                            rule.value = new FshQuantity(valueSibling.value, new FshCode(rule.value.code));
                            rulesToRemove.push(instance.rules.indexOf(valueSibling));
                            if (systemSibling) {
                                rule.value.unit.system = systemSibling.value.toString();
                                rulesToRemove.push(instance.rules.indexOf(systemSibling));
                            }
                            if (unitSibling) {
                                rule.value.unit.display = unitSibling.value.toString();
                                rulesToRemove.push(instance.rules.indexOf(unitSibling));
                            }
                        }
                        else {
                            if (systemSibling) {
                                rule.value.system = systemSibling.value.toString();
                                rulesToRemove.push(instance.rules.indexOf(systemSibling));
                            }
                            if (displaySibling || unitSibling) {
                                const displaySource = displaySibling || unitSibling;
                                rule.value.display = displaySource.value.toString();
                                rulesToRemove.push(instance.rules.indexOf(displaySource));
                            }
                            moveUpAssignmentRule(rule, instance, siblings);
                        }
                    }
                }
            });
            (0, lodash_1.pullAt)(instance.rules, rulesToRemove);
        });
    }
};
function moveUpCaretValueRule(rule, sd, knownSiblings) {
    // if the caretPath ends with coding[0], and there are no sibling rules that use indices on coding,
    // we can move the rule up a level to take advantage of how SUSHI handles rules on CodeableConcepts.
    if (rule.caretPath.endsWith('coding[0]')) {
        const basePath = rule.caretPath.replace(/\.coding\[0]$/, '');
        const hasOtherSiblings = sd.rules.some((otherRule) => rule !== otherRule &&
            otherRule instanceof exportable_1.ExportableCaretValueRule &&
            !knownSiblings.includes(otherRule) &&
            rule.path === otherRule.path &&
            otherRule.caretPath.startsWith(`${basePath}.coding[`));
        if (!hasOtherSiblings) {
            rule.caretPath = basePath;
        }
    }
}
function moveUpAssignmentRule(rule, instance, knownSiblings) {
    // if the path ends with coding[0], and there are no sibling rules that use indices on coding,
    // we can move the rule up a level to take advantage of how SUSHI handles rules on CodeableConcepts.
    if (rule.path.endsWith('coding[0]')) {
        const basePath = rule.path.replace(/\.coding\[0]$/, '');
        const hasOtherSiblings = instance.rules.some(otherRule => rule !== otherRule &&
            otherRule instanceof exportable_1.ExportableAssignmentRule &&
            !knownSiblings.includes(otherRule) &&
            otherRule.path.startsWith(`${basePath}.coding[`));
        if (!hasOtherSiblings) {
            rule.path = basePath;
        }
    }
}
//# sourceMappingURL=CombineCodingAndQuantityValuesOptimizer.js.map
