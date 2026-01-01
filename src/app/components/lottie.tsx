import Lottie from "lottie-web";
import { CSSProperties, ReactNode, useEffect, useRef } from "react"

interface props {
    path: string,
    style: CSSProperties
}
const LottieAnimation:React.FC<props> = ({path,style }) => {
    const container = useRef(null);
    useEffect(() => {
    const anim = Lottie.loadAnimation({
      container: container.current!,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: path,
    });


    return () => anim.destroy();
  }, []);

  return (
    <div style={style} ref={container}></div>
  )

}
export default LottieAnimation;