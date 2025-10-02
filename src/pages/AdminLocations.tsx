import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from "@/lib/api";
import { isCurrentUserAdmin } from "@/lib/auth";

interface Location {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({ name: "", logo_url: "", address: "" });
  const [viewingLocation, setViewingLocation] = useState<Location | null>(null);

  useEffect(() => {
    checkAdmin();
    loadLocations();
  }, []);

  const checkAdmin = async () => {
    const adminStatus = await isCurrentUserAdmin();
    setIsAdmin(adminStatus);
    if (!adminStatus) {
      setError("You must be an admin to access this page");
    }
  };

  const loadLocations = async () => {
    try {
      const allLocations = await getLocations(true); // Include inactive
      setLocations(allLocations);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLocation(formData);
      setFormData({ name: "", logo_url: "", address: "" });
      setIsAddModalOpen(false);
      loadLocations();
    } catch (err: any) {
      alert("Failed to add location: " + err.message);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;

    try {
      await updateLocation(editingLocation.id, formData);
      setFormData({ name: "", logo_url: "", address: "" });
      setEditingLocation(null);
      loadLocations();
    } catch (err: any) {
      alert("Failed to update location: " + err.message);
    }
  };

  const handleToggleActive = async (location: Location) => {
    try {
      await updateLocation(location.id, { is_active: !location.is_active });
      loadLocations();
    } catch (err: any) {
      alert("Failed to update location status: " + err.message);
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    if (
      !confirm(
        `Are you sure you want to delete "${location.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteLocation(location.id);
      loadLocations();
    } catch (err: any) {
      alert("Failed to delete location: " + err.message);
    }
  };

  const openEditModal = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      logo_url: location.logo_url || "",
      address: location.address || ""
    });
  };

  const getGoogleMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">
            You must be an admin to access this page
          </p>
        </div>
        <Link to="/matches" className="text-primary hover:underline">
          ← Back to matches
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Loading locations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Locations</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg font-medium transition text-sm"
          >
            + Location
          </button>
          <Link
            to="/matches"
            className="text-primary hover:underline flex items-center"
          >
            ← Back to matches
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Logo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {locations.map((location) => (
                <tr key={location.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {location.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {location.address ? (
                      <div className="text-sm text-gray-600 max-w-xs">
                        {location.address}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No address</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {location.logo_url ? (
                      <img
                        src={location.logo_url}
                        alt={location.name}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">No logo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {location.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-3">
                      {location.address && (
                        <button
                          onClick={() => setViewingLocation(location)}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View Map
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(location)}
                        className="text-primary hover:text-primary-dark font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(location)}
                        className={`${
                          location.is_active
                            ? "text-orange-600 hover:text-orange-700"
                            : "text-green-600 hover:text-green-700"
                        } font-medium`}
                      >
                        {location.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Map Viewing Modal */}
      {viewingLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{viewingLocation.name}</h2>
              <button
                onClick={() => setViewingLocation(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <p className="text-gray-600 mb-2">Address:</p>
              <p className="text-lg text-gray-900">{viewingLocation.address}</p>
            </div>
            <div className="flex gap-3">
              <a
                href={getGoogleMapsUrl(viewingLocation.address!)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-primary hover:bg-primary-dark text-white text-center px-6 py-3 rounded-lg font-medium transition"
              >
                Open in Google Maps
              </a>
              <button
                onClick={() => setViewingLocation(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(isAddModalOpen || editingLocation) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingLocation ? "Edit Location" : "Location"}
            </h2>
            <form
              onSubmit={
                editingLocation ? handleUpdateLocation : handleAddLocation
              }
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Location Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., The Padel Courts - Court 1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="logo_url"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Logo URL (optional)
                </label>
                <input
                  type="url"
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) =>
                    setFormData({ ...formData, logo_url: e.target.value })
                  }
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Address (optional)
                </label>
                <input
                  type="text"
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="123 Main St, City, State ZIP"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingLocation(null);
                    setFormData({ name: "", logo_url: "", address: "" });
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition"
                >
                  {editingLocation ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
