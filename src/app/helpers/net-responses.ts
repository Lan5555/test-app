export interface Net{
    success:boolean;
    message:string;
    data:Record<string,any> | null
}

export class NetResponse{
    constructor(private readonly response:Net){}

    get success(){
        return this.response.success;
    }

    get message(){
        return this.response.message;
    }
    get data(){
        return this.response.data;
    }
}