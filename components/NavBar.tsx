import Image from 'next/image';

const styles = `
  .logo-container {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 8px;
    margin-left: 16px;
  }
  
  .servio-logo {
    transition: transform 0.3s, box-shadow 0.3s;
    cursor: pointer;
    max-width: 100%;
    height: auto;
  }
  
  .servio-logo:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
`;

// Inject styles into the document head
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = styles;
  document.head.appendChild(styleTag);
}

const NavBar = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16">
        {/* Logo */}
        <div className="logo-container">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio"
            width={150}
            height={50}
            className="servio-logo"
          />
        </div>
        {/* Other nav items can go here */}
      </div>
    </div>
  );
};

export default NavBar;