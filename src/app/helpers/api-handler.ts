import { Net, NetResponse } from "./net-responses";

export class CoreService{
    BASE_URL=process.env.NEXT_PUBLIC_DATABASE_LINK;

    fallback:Net = {
        success:false,
        message:'',
        data:null
    }

    setBaseUrl(url: any){
        this.BASE_URL = url;
    }

    
    public async send(endpoint:string, payload:Record<string,any>):Promise<NetResponse>{
        try{
            const res = await fetch(`${this.BASE_URL}${endpoint}`, {
                method:'POST',
                headers:{
                    'Content-Type':'application/json'
                },
                body:JSON.stringify(payload)
            });
            const data = await res.json();
            const response:Net = {
                success:data.success,
                message:data.message,
                data:data.data
            };
            
           return new NetResponse(response);
        }catch(e:any){
            alert(e);
        }
        return new NetResponse(this.fallback);
    }

     public async delete(endpoint:string, payload:Record<string,any>):Promise<NetResponse>{
        try{
            const res = await fetch(`${this.BASE_URL}${endpoint}`, {
                method:'DELETE',
                headers:{
                    'Content-Type':'application/json'
                },
                body:JSON.stringify(payload)
            });
            const data = await res.json();
            const response:Net = {
                success:data.success,
                message:data.message,
                data:data.data
            };
            
           return new NetResponse(response);
        }catch(e:any){
            alert(e);
        }
        return new NetResponse(this.fallback);
    }

    public async get(endpoint:string):Promise<NetResponse> {
        try{
            const res = await fetch(`${this.BASE_URL}${endpoint}`)
            const data = await res.json();
            const response:Net = {
                success:data.success,
                message:data.message,
                data:data.data
            };
            return new NetResponse(response);
        }catch(e:any){
            alert(e);
        }
        return new NetResponse(this.fallback);
    }
}


