import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { ProviderManagementComponent } from './provider-management.component';

const routes: Routes = [
  { path: '', component: ProviderManagementComponent }
];

@NgModule({
  declarations: [
    ProviderManagementComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class ProviderManagementModule { }
