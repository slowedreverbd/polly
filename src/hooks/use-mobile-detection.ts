import { useEffect, useState } from "react";

export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640; // Tailwind's sm breakpoint
      setIsMobile(mobile);

      // Add data attribute to body for CSS targeting
      if (mobile) {
        document.body.setAttribute("data-mobile", "true");
        document.documentElement.setAttribute("data-mobile", "true");
      } else {
        document.body.removeAttribute("data-mobile");
        document.documentElement.removeAttribute("data-mobile");
      }
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile;
};
