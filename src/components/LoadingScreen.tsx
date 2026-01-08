export function LoadingScreen() {

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#0a0a1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      {/* Паутина дорог на весь экран */}
      <svg 
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 100,
          pointerEvents: 'none'
        }}
      >
        <defs>
          <style>
            {`
              .road-line {
                stroke: #ffffff;
                stroke-width: 0.2;
                stroke-dasharray: 200;
                stroke-dashoffset: 200;
                animation: drawRoad 2s ease-out forwards;
                opacity: 0.8;
                vector-effect: non-scaling-stroke;
              }
              
              @keyframes drawRoad {
                to {
                  stroke-dashoffset: 0;
                }
              }
            `}
          </style>
        </defs>
        
        {/* Основные линии от центра к краям */}
        <line x1="50" y1="50" x2="0" y2="50" className="road-line" style={{ animationDelay: '0s' }} />
        <line x1="50" y1="50" x2="100" y2="50" className="road-line" style={{ animationDelay: '0.1s' }} />
        <line x1="50" y1="50" x2="50" y2="0" className="road-line" style={{ animationDelay: '0.2s' }} />
        <line x1="50" y1="50" x2="50" y2="100" className="road-line" style={{ animationDelay: '0.3s' }} />
        
        {/* Диагональные линии */}
        <line x1="50" y1="50" x2="0" y2="0" className="road-line" style={{ animationDelay: '0.4s' }} />
        <line x1="50" y1="50" x2="100" y2="0" className="road-line" style={{ animationDelay: '0.5s' }} />
        <line x1="50" y1="50" x2="0" y2="100" className="road-line" style={{ animationDelay: '0.6s' }} />
        <line x1="50" y1="50" x2="100" y2="100" className="road-line" style={{ animationDelay: '0.7s' }} />
        
        {/* Дополнительные линии для паутины - верхняя половина */}
        <line x1="50" y1="50" x2="25" y2="0" className="road-line" style={{ animationDelay: '0.8s' }} />
        <line x1="50" y1="50" x2="75" y2="0" className="road-line" style={{ animationDelay: '0.9s' }} />
        
        {/* Дополнительные линии - правая половина */}
        <line x1="50" y1="50" x2="100" y2="25" className="road-line" style={{ animationDelay: '1s' }} />
        <line x1="50" y1="50" x2="100" y2="75" className="road-line" style={{ animationDelay: '1.1s' }} />
        
        {/* Дополнительные линии - нижняя половина */}
        <line x1="50" y1="50" x2="25" y2="100" className="road-line" style={{ animationDelay: '1.2s' }} />
        <line x1="50" y1="50" x2="75" y2="100" className="road-line" style={{ animationDelay: '1.3s' }} />
        
        {/* Дополнительные линии - левая половина */}
        <line x1="50" y1="50" x2="0" y2="25" className="road-line" style={{ animationDelay: '1.4s' }} />
        <line x1="50" y1="50" x2="0" y2="75" className="road-line" style={{ animationDelay: '1.5s' }} />
        
        {/* Промежуточные линии для более плотной паутины */}
        <line x1="50" y1="50" x2="12.5" y2="0" className="road-line" style={{ animationDelay: '1.6s' }} />
        <line x1="50" y1="50" x2="37.5" y2="0" className="road-line" style={{ animationDelay: '1.7s' }} />
        <line x1="50" y1="50" x2="62.5" y2="0" className="road-line" style={{ animationDelay: '1.8s' }} />
        <line x1="50" y1="50" x2="87.5" y2="0" className="road-line" style={{ animationDelay: '1.9s' }} />
        
        <line x1="50" y1="50" x2="100" y2="12.5" className="road-line" style={{ animationDelay: '2s' }} />
        <line x1="50" y1="50" x2="100" y2="37.5" className="road-line" style={{ animationDelay: '2.1s' }} />
        <line x1="50" y1="50" x2="100" y2="62.5" className="road-line" style={{ animationDelay: '2.2s' }} />
        <line x1="50" y1="50" x2="100" y2="87.5" className="road-line" style={{ animationDelay: '2.3s' }} />
        
        <line x1="50" y1="50" x2="12.5" y2="100" className="road-line" style={{ animationDelay: '2.4s' }} />
        <line x1="50" y1="50" x2="37.5" y2="100" className="road-line" style={{ animationDelay: '2.5s' }} />
        <line x1="50" y1="50" x2="62.5" y2="100" className="road-line" style={{ animationDelay: '2.6s' }} />
        <line x1="50" y1="50" x2="87.5" y2="100" className="road-line" style={{ animationDelay: '2.7s' }} />
        
        <line x1="50" y1="50" x2="0" y2="12.5" className="road-line" style={{ animationDelay: '2.8s' }} />
        <line x1="50" y1="50" x2="0" y2="37.5" className="road-line" style={{ animationDelay: '2.9s' }} />
        <line x1="50" y1="50" x2="0" y2="62.5" className="road-line" style={{ animationDelay: '3s' }} />
        <line x1="50" y1="50" x2="0" y2="87.5" className="road-line" style={{ animationDelay: '3.1s' }} />
      </svg>
      
      {/* Логотип */}
      <div style={{
        position: 'relative',
        zIndex: 101,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img 
          src="/neuromap/logo.png" 
          alt="NeuroMap"
          style={{
            width: '200px',
            height: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 30px rgba(240, 248, 255, 0.5))',
            animation: 'pulse 2s infinite'
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
          }
        `}
      </style>
    </div>
  );
}
