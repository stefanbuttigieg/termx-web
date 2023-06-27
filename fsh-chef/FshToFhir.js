"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fshToFhir = void 0;
const import_1 = require("../import");
const export_1 = require("../export");
const fhirdefs_1 = require("../fhirdefs");
const utils_1 = require("../utils");
/**
 * This function can be used to process input string(s) containing FSH definitions into JSON.
 * NOTE: This function is not safe for true asynchronous usage. If two calls of this function are running at once, the error and warnings reported
 * will be inconsistent. Always ensure a given call to this function completes before making a new call.
 * @param {string|string[]} input - A string or array of strings containing FSH
 * @param {fshToFhirOptions} options - An object containing options for processing. Options include canonical, version, fhirVersion, dependencies, and logLevel
 * @returns {Promise<{fhir: any[]; errors: ErrorsAndWarnings['errors']; warnings: ErrorsAndWarnings['warnings'];}>} - Object containing generated fhir, and errors/warnings from processing
 */
function fshToFhir(input, options = {}) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        // track errors and warnings, and determine log level from options
        utils_1.errorsAndWarnings.reset();
        utils_1.errorsAndWarnings.shouldTrack = true;
        if (options.logLevel == 'silent') {
            utils_1.logger.transports[0].silent = true;
        }
        else if (options.logLevel != null) {
            if (!isLevel(options.logLevel)) {
                return {
                    fhir: null,
                    errors: [
                        {
                            message: `Invalid logLevel: ${options.logLevel}. Valid levels include: ${levels.join(', ')}.`
                        }
                    ],
                    warnings: []
                };
            }
            utils_1.logger.level = options.logLevel;
        }
        // set up a config so that sushi can run
        const config = {
            canonical: (_a = options.canonical) !== null && _a !== void 0 ? _a : 'http://example.org',
            FSHOnly: true,
            fhirVersion: [(_b = options.fhirVersion) !== null && _b !== void 0 ? _b : '4.0.1'],
            dependencies: options.dependencies,
            version: options.version
        };
        // load dependencies
        const defs = new fhirdefs_1.FHIRDefinitions();
        yield utils_1.loadExternalDependencies(defs, config);
        // load FSH text into memory
        const rawFSHes = [];
        if (Array.isArray(input)) {
            input.forEach((input, i) => {
                rawFSHes.push(new import_1.RawFSH(input, `Input_${i}`));
            });
        }
        else {
            rawFSHes.push(new import_1.RawFSH(input));
        }
        const tank = utils_1.fillTank(rawFSHes, config);
        // process FSH text into FHIR
        const outPackage = export_1.exportFHIR(tank, defs);
        const fhir = [];
        console.log(outPackage);
        ['profiles', 'extensions', 'instances', 'valueSets', 'codeSystems', 'logicals'].forEach(artifactType => {
            outPackage[artifactType].forEach((artifact) => {
                fhir.push(artifact.toJSON(false));
            });
        });
        return {
            fhir,
            errors: utils_1.errorsAndWarnings.errors,
            warnings: utils_1.errorsAndWarnings.warnings
        };
    });
}
exports.fshToFhir = fshToFhir;
// Winston levels: https://github.com/winstonjs/winston#logging-levels plus a silent option
const levels = ['silly', 'debug', 'verbose', 'http', 'info', 'warn', 'error', 'silent'];
function isLevel(level) {
    return levels.includes(level);
}
//# sourceMappingURL=FshToFhir.js.map
