import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MigrationComponent } from './migration.component';

const routes: Routes = [
  { path: '', component: MigrationComponent }
];

@NgModule({
  declarations: [
    MigrationComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class MigrationModule { }
