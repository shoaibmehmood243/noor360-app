import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export const ScholarIcon: React.FC<IconProps> = ({ color, size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="2" fill={color} />
    </Svg>
  );
};

export default ScholarIcon;
