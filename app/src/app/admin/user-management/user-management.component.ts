import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserManagementService } from './user-management.service';
import { User } from './user.model';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  selectedUser: User | null = null;
  userForm: FormGroup;
  isLoading = false;
  isEditing = false;
  
  constructor(
    private userService: UserManagementService,
    private formBuilder: FormBuilder
  ) {
    this.userForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      firstName: [''],
      lastName: [''],
      password: [''],
      status: ['ACTIVE', Validators.required]
    });
  }
  
  ngOnInit(): void {
    this.loadUsers();
  }
  
  loadUsers(): void {
    this.isLoading = true;
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading users', error);
        this.isLoading = false;
      }
    });
  }
  
  selectUser(user: User): void {
    this.selectedUser = user;
    this.isEditing = true;
    
    this.userForm.patchValue({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status
    });
    
    // Clear password field when editing
    this.userForm.get('username')?.disable();
    this.userForm.get('password')?.setValue('');
  }
  
  createNewUser(): void {
    this.selectedUser = null;
    this.isEditing = false;
    
    this.userForm.reset({
      status: 'ACTIVE'
    });
    
    this.userForm.get('username')?.enable();
  }
  
  saveUser(): void {
    if (this.userForm.invalid) {
      return;
    }
    
    const userData = this.userForm.value;
    
    // If password is empty and we're editing, remove it from the payload
    if (this.isEditing && !userData.password) {
      delete userData.password;
    }
    
    this.isLoading = true;
    
    if (this.isEditing && this.selectedUser) {
      // Update existing user
      this.userService.updateUser(this.selectedUser.id, userData).subscribe({
        next: () => {
          this.loadUsers();
          this.selectedUser = null;
        },
        error: (error) => {
          console.error('Error updating user', error);
          this.isLoading = false;
        }
      });
    } else {
      // Create new user
      this.userService.createUser(userData).subscribe({
        next: () => {
          this.loadUsers();
          this.selectedUser = null;
        },
        error: (error) => {
          console.error('Error creating user', error);
          this.isLoading = false;
        }
      });
    }
  }
  
  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
      this.isLoading = true;
      this.userService.deleteUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
          if (this.selectedUser?.id === user.id) {
            this.selectedUser = null;
          }
        },
        error: (error) => {
          console.error('Error deleting user', error);
          this.isLoading = false;
        }
      });
    }
  }
  
  cancel(): void {
    this.selectedUser = null;
    this.userForm.reset({
      status: 'ACTIVE'
    });
  }
}
