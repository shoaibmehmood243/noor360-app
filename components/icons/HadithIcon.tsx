import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export const HadithIcon: React.FC<IconProps> = ({ color, size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Scroll Background Document */}
      <Path
        d="M16 2H5C3.5 2 3.5 5 5 5H16C17.5 5 17.5 2 16 2Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 19H5C3.5 19 3.5 22 5 22H16C17.5 19 17.5 22 16 19Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 5V19M15 5V19"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Horizontal Writing Lines on the Scroll */}
      <Path
        d="M7 9H12M7 13H10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Prophetic Quill / Feather Pen Writing on the Hadith Scroll */}
      <Path
        d="M21 3L11 15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 6C17.5 7.5 15.5 9 14.5 11M20.5 4.5C19 6 17 7.5 16 9.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default HadithIcon;
