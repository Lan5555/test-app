import { ArrowRight, Book } from "lucide-react";

interface props{
    name: string;
    subtitle?: string;
}

const QuizHolder:React.FC<props> = ({name, subtitle}) => {
    return <div className="shadow rounded-2xl w-full h-20 p-2 flex justify-between items-center bg-white">
         <div className="flex justify-center items-center gap-4">
            <Book className="w-5 h-5 text-black"></Book>
            <div className="flex justify-start gap-2 flex-col">
                <h2 className="bg-linear-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent">{name}</h2>
                <small className="text-black opacity-55">{subtitle}</small>
            </div>
            </div>
            <button className="rounded-full p-2 shadow  bg-linear-to-r from-pink-400 to-blue-400">
             <ArrowRight className="w-5 h-5 text-black"></ArrowRight>
            </button>
    </div>
}
export default QuizHolder;