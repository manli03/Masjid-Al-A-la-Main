import { CanActivateFn, Router } from '@angular/router';


// This is the function-based guard
export const authGuard: CanActivateFn = (route, state) => {
  // Check if the user is authenticated by checking the localStorage
  const isAuthenticated = localStorage.getItem('userToken') !== null;
  const router = new Router();

  if (isAuthenticated) {
    return true;  // If authenticated, allow the navigation
  } else {
    // Redirect to the login page if not authenticated
    router.navigate(['/tabs/bridge-login']);
    return false;
  }
};