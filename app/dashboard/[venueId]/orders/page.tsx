import NavBar from '@/components/NavBar';
import OrdersClient from './OrdersClient';

export default function OrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <NavBar venueId={venueId} />
      <OrdersClient venueId={venueId} />
    </>
  );
}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Orders</h2>
          <p className="text-gray-600">Monitor and manage incoming orders in real-time</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">£{stats.revenue.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Orders */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Orders</h3>
          </CardHeader>
          <CardContent>
            <LiveOrders 
              venueId={params.venueId}
              session={session}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
