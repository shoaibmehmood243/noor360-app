import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export const QuranIcon: React.FC<IconProps> = ({ color, size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Open Holy Quran Book Pages */}
      <Path
        d="M12 6C12 6 7 2 2.5 2V12C7 12 12 16 12 16C12 16 17 12 21.5 12V2C17 2 12 6 12 6Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 6V16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Elegant Intersecting Rehal (Wooden Book Stand) Legs */}
      <Path
        d="M4 17L12 13L20 17"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 21L18 15M18 21L6 15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default QuranIcon;
