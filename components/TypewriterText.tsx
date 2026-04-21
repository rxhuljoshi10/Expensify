import React, { useState, useEffect } from 'react';
import { Text, TextStyle } from 'react-native';

interface TypewriterTextProps {
    text: string;
    style?: TextStyle;
    delay?: number;
    onComplete?: () => void;
}

export default function TypewriterText({ text, style, delay = 100, onComplete }: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState('');
    const words = text.split(' ');

    useEffect(() => {
        setDisplayedText('');
        let currentWordIndex = 0;
        
        const interval = setInterval(() => {
            if (currentWordIndex < words.length) {
                setDisplayedText((prev) => 
                    prev + (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex]
                );
                currentWordIndex++;
            } else {
                clearInterval(interval);
                onComplete?.();
            }
        }, delay);

        return () => clearInterval(interval);
    }, [text]);

    return <Text style={style}>{displayedText}</Text>;
}
