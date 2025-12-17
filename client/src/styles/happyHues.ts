// Happy Hues風カラーパレットとスタイル定義
export const happyHuesColors = {
    background: '#fffffe',
    headline: '#272343',
    paragraph: '#2d334a',
    button: '#ffd803',
    buttonText: '#272343',
    main: '#fffffe',
    highlight: '#ffd803',
    secondary: '#e3f6f5',
    tertiary: '#bae8e8',
    red: '#DC0000',
    lightRed: '#FF3838',
    // Happy Hues追加カラー
    accent1: '#ff6e6c',
    accent2: '#ffd93d',
    accent3: '#6bcf7f',
    accent4: '#4d96ff',
    accent5: '#c44569',
};

export const happyHuesStyles = {
    fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    backgroundGradient: `linear-gradient(135deg, ${happyHuesColors.background} 0%, ${happyHuesColors.secondary} 50%, ${happyHuesColors.tertiary} 100%)`,
    card: {
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '2rem',
        boxShadow: '0 10px 40px rgba(39, 35, 67, 0.15), 0 4px 12px rgba(39, 35, 67, 0.1)',
        border: `3px solid ${happyHuesColors.tertiary}`,
    },
    cardSmall: {
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '1.5rem',
        boxShadow: '0 4px 12px rgba(39, 35, 67, 0.1)',
        border: `2px solid ${happyHuesColors.tertiary}`,
    },
    button: {
        background: `linear-gradient(135deg, ${happyHuesColors.button} 0%, ${happyHuesColors.accent2} 100%)`,
        color: happyHuesColors.buttonText,
        boxShadow: '0 6px 20px rgba(255, 216, 3, 0.4)',
        border: `2px solid ${happyHuesColors.headline}`,
        borderRadius: '1.5rem',
    },
    input: {
        background: happyHuesColors.secondary,
        border: `2px solid ${happyHuesColors.tertiary}`,
        borderRadius: '1rem',
        color: happyHuesColors.headline,
    },
};

