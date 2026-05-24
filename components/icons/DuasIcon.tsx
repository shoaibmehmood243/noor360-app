import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export const DuasIcon: React.FC<IconProps> = ({ color, size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Raised supplicating hands (Dua hands) */}
      <Path
        d="M5 18C5 18 8 14 8 9C8 5.5 6.5 4 6.5 4M19 18C19 18 16 14 16 9C16 5.5 17.5 4 17.5 4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 19C10 19 11 15 11 10C11 9 10 7 10 7M14 19C14 19 13 15 13 10C13 9 14 7 14 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 21C8.5 21 10 20.5 12 19.5C14 20.5 15.5 21 17 21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default DuasIcon;
