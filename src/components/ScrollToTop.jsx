import React from 'react';
import { ArrowUp } from 'lucide-react';
import useScrollToTop from '../hooks/useScrollToTop';
import './ScrollToTop.css';

const ScrollToTop = ({ threshold = 300 }) => {
  const { isVisible, scrollToTop } = useScrollToTop(threshold);

  return (
    isVisible && (
      <button
        className="scroll-to-top-btn"
        onClick={scrollToTop}
        title="Scroll to top"
        aria-label="Scroll to top of page"
      >
        <ArrowUp size={20} />
      </button>
    )
  );
};

export default ScrollToTop;
