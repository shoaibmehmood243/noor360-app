import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export const HadithIcon: React.FC<IconProps> = ({ color, size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top Scroll Roll */}
      <Path
        d="M4 5C4 3.9 4.9 3 6 3H18C19.1 3 20 3.9 20 5C20 6.1 19.1 7 18 7H6C4.9 7 4 6.1 4 5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Scroll Sheet Sides */}
      <Path
        d="M6 7V17M18 7V17"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom Scroll Roll */}
      <Path
        d="M4 19C4 17.9 4.9 17 6 17H18C19.1 17 20 17.9 20 19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Scroll Text Lines */}
      <Path
        d="M9 11H15M9 14H13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default HadithIcon;
