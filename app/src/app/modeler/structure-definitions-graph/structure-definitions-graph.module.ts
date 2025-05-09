import {Routes} from '@angular/router';
import {NgModule} from '@angular/core';
import {CoreUiModule} from '../../core/ui/core-ui.module';
import {StructureDefinitionsGraphComponent} from './containers/structure-definitions-graph.component';

export const STRUCTURE_DEFINITIONS_GRAPH_ROUTES: Routes = [
    {path: 'structure-definitions-graph', component: StructureDefinitionsGraphComponent},
];

@NgModule({
    imports: [
      CoreUiModule
    ],
    declarations: [
      StructureDefinitionsGraphComponent,
    ]
})
export class StructureDefinitionsGraphModule {}
