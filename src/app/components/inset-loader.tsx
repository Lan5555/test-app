import { Loader2 } from "lucide-react"

const InsetLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 flex-col gap-5">
      <Loader2 className="text-blue-500 w-20 h-20 animate-spin opacity-80" />
      <h1 className="text-white">Saving quiz data....</h1>
    </div>
  )
}

export default InsetLoader