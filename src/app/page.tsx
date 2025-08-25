import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="text-white text-2xl font-bold">Servio</div>
          <div className="hidden md:flex space-x-8">
            <Link href="/" className="text-white hover:text-purple-200 transition-colors">Home</Link>
            <Link href="/features" className="text-white hover:text-purple-200 transition-colors">Features</Link>
            <Link href="/pricing" className="text-white hover:text-purple-200 transition-colors">Pricing</Link>
            <Link href="/sign-in" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors">Sign In</Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Section */}
          <div className="text-white">
            <div className="text-gray-300 text-sm font-medium mb-4">Transform Your Business</div>
            <h1 className="text-5xl font-bold mb-6">QR Code Ordering Made Simple</h1>
            <p className="text-xl text-purple-100 mb-8">
              Streamline your business operations with contactless QR code ordering. 
              Customers scan, order, and pay - all from their phones. You focus on great food and service.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link 
                href="/sign-up" 
                className="bg-white text-purple-600 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Start Free Trial →
              </Link>
              <Link 
                href="/demo" 
                className="bg-transparent text-white font-semibold py-3 px-8 rounded-lg border-2 border-white hover:bg-white hover:text-purple-600 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                </svg>
                View Demo
              </Link>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right Section - QR Code Demo */}
          <div className="flex justify-center lg:justify-end">
            <div className="bg-white rounded-2xl p-8 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <div className="text-center">
                {/* QR Code Icon */}
                <div className="w-32 h-32 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-20 h-20 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 11h6v6H3v-6zm2 2v2h2v-2H5zm8 2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4-4h2v2h-2V9zm4 0h2v2h-2V9zm-4-4h2v2h-2V5zm4 0h2v2h-2V5z"/>
                  </svg>
                </div>
                
                <div className="text-2xl font-bold text-gray-900 mb-2">Table 5</div>
                <div className="text-gray-600 mb-6">Scan to view menu & order</div>
                
                <button className="bg-green-500 text-white font-semibold py-3 px-8 rounded-lg hover:bg-green-600 transition-colors">
                  Ready to Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
