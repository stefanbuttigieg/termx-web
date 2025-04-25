import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { UserManagementComponent } from './user-management.component';

const routes: Routes = [
  { path: '', component: UserManagementComponent }
];

@NgModule({
  declarations: [
    UserManagementComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class UserManagementModule { }
