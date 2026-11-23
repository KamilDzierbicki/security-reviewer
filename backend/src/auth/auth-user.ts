export interface AuthUser {
  id: string;
  email: string;
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
    refreshTokens: false;
  }
}
