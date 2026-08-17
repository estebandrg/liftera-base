export class DIContainer {
  private registry = new Map<string, unknown>();

  register<T>(token: string, implementation: T): void {
    this.registry.set(token, implementation);
  }

  resolve<T>(token: string): T {
    const instance = this.registry.get(token);
    if (!instance) {
      throw new Error(`No registration found for token: ${token}`);
    }
    return instance as T;
  }
}

export const container = new DIContainer();
