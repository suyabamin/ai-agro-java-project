import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';

interface FarmerSpecialist {
  id: string;
  name: string;
  location: string;
  specialization: string;
  rating: number;
  completedJobs: number;
  available: boolean;
  avatarText: string;
}

export const FarmerDirectoryPage: React.FC = () => {
  const { activeFarm } = useFarm();

  const [searchTerm, setSearchTerm] = useState('');

  // Directory of verified agricultural field specialists
  const specialists: FarmerSpecialist[] = [
    {
      id: 'farmer-rahim-01',
      name: 'Rahim Uddin',
      location: 'Gazipur, Dhaka',
      specialization: 'Aman & Boro Rice Agronomy',
      rating: 4.9,
      completedJobs: 38,
      available: true,
      avatarText: 'RU',
    },
    {
      id: 'farmer-kabir-02',
      name: 'Kabir Hossain',
      location: 'Mymensingh Sadar',
      specialization: 'Soil Dielectric Telemetry & Irrigation',
      rating: 4.8,
      completedJobs: 24,
      available: true,
      avatarText: 'KH',
    },
    {
      id: 'farmer-salma-03',
      name: 'Salma Begum',
      location: 'Bogra, Rajshahi',
      specialization: 'Vegetable Polyhouse & IPM Scouting',
      rating: 5.0,
      completedJobs: 42,
      available: false,
      avatarText: 'SB',
    },
    {
      id: 'farmer-anwar-04',
      name: 'Anwar Parvez',
      location: 'Rangpur Central',
      specialization: 'Potato & Maize Crop Rotation',
      rating: 4.7,
      completedJobs: 19,
      available: true,
      avatarText: 'AP',
    },
    {
      id: 'farmer-tariq-05',
      name: 'Tariqul Islam',
      location: 'Comilla, Chittagong',
      specialization: 'LoRaWAN Sensor Node Calibration',
      rating: 4.9,
      completedJobs: 31,
      available: true,
      avatarText: 'TI',
    },
  ];

  const filtered = specialists.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.specialization.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Workforce Marketplace
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Agricultural Specialist Directory
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Connect with verified farmers, agronomists, and sensor calibration specialists.
          </p>
        </div>

        {activeFarm && (
          <Link
            to="/dashboard/assignments/new"
            className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 no-underline active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            <span>Assign to Active Field</span>
          </Link>
        )}
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
        <div className="relative w-full sm:w-96 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by farmer name, district, or crop specialty..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-on-surface-variant font-semibold">
          <span>{filtered.length} verified specialists active</span>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((farmer) => (
          <div
            key={farmer.id}
            className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-base shadow-sm">
                    {farmer.avatarText}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-on-surface leading-tight">
                      {farmer.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                      <span>{farmer.location}</span>
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    farmer.available
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {farmer.available ? 'Available' : 'Assigned'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low text-xs space-y-2 mb-4">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                    Core Specialization
                  </span>
                  <div className="font-bold text-on-surface">{farmer.specialization}</div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
                  <div className="flex items-center gap-1 text-primary font-bold">
                    <span className="material-symbols-outlined text-[16px] text-amber-500 fill-current">star</span>
                    <span>{farmer.rating.toFixed(1)} / 5.0</span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant">
                    {farmer.completedJobs} Tenures Completed
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
              <Link
                to={`/dashboard/farmers/${farmer.id}`}
                className="flex-1 h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1 transition-colors no-underline"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
                <span>View Dossier</span>
              </Link>
              {activeFarm && (
                <Link
                  to={`/dashboard/assignments/new?farmerUid=${encodeURIComponent(farmer.id)}`}
                  className="h-9 px-3 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center gap-1 transition-colors no-underline"
                >
                  <span>Assign</span>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
