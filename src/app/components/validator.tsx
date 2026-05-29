import { useEffect } from "react";
import { Token } from "../helpers/decorators";
import { useRouter } from "next/navigation";
import { useToast } from "./toast";

class TokenVerifier{
    @Token
    validate(){
        return true;
    }
}

const tokenVerifier = new TokenVerifier();  
const Validator:React.FC = () => {
    const router = useRouter();
    const {addToast} = useToast()
    
    useEffect(() => {
    if(!tokenVerifier.validate()) {
        router.push('/pages/login');
        addToast('Unauthorized access','error');
    }
    },[]);
    return null;
}
export default Validator;