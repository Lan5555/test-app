export function Token (target: any, propertyKey: string, descriptor: PropertyDescriptor){
    const originalValue = descriptor.value;
    descriptor.value = function(...args: any[]){
        const userSession = sessionStorage.getItem('userSession');
        const adminSession = sessionStorage.getItem('adminSession');
        const session = userSession || adminSession;
        const user = session ? JSON.parse(session) : null;
        if(!user || !user.token){
            return false;
        }
        originalValue.apply(this, args);
        return true;
    }
    return descriptor;
}