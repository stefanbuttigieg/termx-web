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
exports.ResourceMap = exports.fhirToFsh = void 0;
const fsh_sushi_1 = require("fsh-sushi");
const utils_1 = require("../utils");
const processor_1 = require("../processor");
const export_1 = require("../export");
let cacheDefs;
function fhirToFsh(input, options = {}) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        // Set up the logger
        utils_1.errorsAndWarnings.reset();
        utils_1.errorsAndWarnings.shouldTrack = true;
        if (options.logLevel === 'silent') {
            utils_1.logger.transports[0].silent = true;
            fsh_sushi_1.utils.logger.transports[0].silent = true;
        }
        else if (options.logLevel != null) {
            if (!isLevel(options.logLevel)) {
                return {
                    fsh: null,
                    errors: [
                        {
                            message: `Invalid logLevel: ${options.logLevel}. Valid levels include: ${levels.join(', ')}.`
                        }
                    ],
                    warnings: [],
                    configuration: null
                };
            }
            utils_1.logger.level = options.logLevel;
            fsh_sushi_1.utils.logger.level = options.logLevel;
        }
        // Read in the resources, either as JSON objects or as strings
        const docs = [];
        input.forEach((resource, i) => {
            const location = `Input_${i}`;
            if (typeof resource === 'string') {
                try {
                    resource = JSON.parse(resource);
                }
                catch (e) {
                    utils_1.logger.error(`Could not parse ${location} to JSON`);
                    return;
                }
            }
            if ((0, utils_1.isProcessableContent)(resource, location)) {
                docs.push(new processor_1.WildFHIR({ content: resource }, location));
            }
        });
        // Get options for optimizers (currently just the indent flag)
        const processingOptions = {
            indent: options.indent === true
        };
        // Set up the FHIRProcessor
        const lake = new processor_1.LakeOfFHIR(docs);
        const defs = cacheDefs ? cacheDefs : new utils_1.FHIRDefinitions();
        const fisher = new utils_1.MasterFisher(lake, defs);
        const processor = new processor_1.FHIRProcessor(lake, fisher);
        // Process the configuration
        const configuration = processor.processConfig(((_a = options.dependencies) !== null && _a !== void 0 ? _a : []).map(d => d.replace('#', '@')));
        // Load dependencies, including those inferred from an IG file, and those given as input
        if (!cacheDefs) {
            yield (0, utils_1.loadExternalDependencies)(defs, configuration);
            cacheDefs = defs;
        }
        // Process the FHIR to rules, and then export to FSH
        const pkg = yield (0, utils_1.getResources)(processor, configuration, processingOptions);
        // Default to exporting as a single string
        return {
            fsh: new export_1.FSHExporter(pkg).apiExport(options.style === 'map' ? 'map' : 'string'),
            configuration: configuration.config,
            errors: utils_1.errorsAndWarnings.errors,
            warnings: utils_1.errorsAndWarnings.warnings
        };
    });
}
exports.fhirToFsh = fhirToFsh;
// An extended class with a custom toJSON method is needed, as JSON.stringify() cannot serialize regular Maps
class ResourceMap extends Map {
    toJSON() {
        const returnObj = {};
        this.forEach((value, key) => {
            returnObj[key] = value;
        });
        return returnObj;
    }
}
exports.ResourceMap = ResourceMap;
// Winston levels: https://github.com/winstonjs/winston#logging-levels plus a silent option
const levels = ['silly', 'debug', 'verbose', 'http', 'info', 'warn', 'error', 'silent'];
function isLevel(level) {
    return levels.includes(level);
}
//# sourceMappingURL=FhirToFsh.js.map
