import React, { useState } from 'react';

const Task3 = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [assignedTo, setAssignedTo] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [createdBy, setCreatedBy] = useState(''); // State for CREATED BY field

  const handleAssignClick = () => {
    setShowDropdown(!showDropdown);
  };

  const handleAssignSelect = (name) => {
    setAssignedTo(name);
    setShowDropdown(false);
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 overflow-y-auto max-h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-blue-500 text-xl font-semibold">ADD TASK</h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={handleClose}>
            ×
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-600 font-medium mb-1">CREATED BY</label>
            <input
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-1">SUBJECT</label>
            <input
              type="text"
              className="w-full p-2 border rounded-md"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-1">TICKET DETAILS...</label>
            <textarea
              className="w-full p-2 border rounded-md h-24"
              placeholder=""
            ></textarea>
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-1">ATTACHMENTS</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="w-full p-2 border rounded-md bg-blue-500 text-white cursor-pointer hidden"
              id="fileInput"
            />
            <label
              htmlFor="fileInput"
              className="w-full bg-blue-500 text-white p-2 rounded-md flex items-center justify-center cursor-pointer"
            >
              <span className="mr-2">📎</span> PHOTO/PDF
            </label>
            {selectedFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-gray-600">Selected Images:</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedFiles.map((file, index) => (
                    <img
                      key={index}
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index}`}
                      className="w-full h-20 object-cover rounded-md"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            {/* <label className="block text-gray-600 font-medium mb-1">ASSIGN</label> */}
            <div className="relative">
              <input
                type="text"
                value={assignedTo}
                onClick={handleAssignClick}
                className="w-full p-2 border rounded-md cursor-pointer bg-gray-100"
                placeholder="ASSIGN TO"
                readOnly
              />
              {showDropdown && (
                <div className="absolute w-full bg-white border rounded-md mt-1 z-10">
                  <div
                    onClick={() => handleAssignSelect('SOHAIL')}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    SOHAIL
                  </div>
                  <div
                    onClick={() => handleAssignSelect('AAA')}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    SOYEB
                  </div>
                  <div
                    onClick={() => handleAssignSelect('ADMIN')}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    ADMIN
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="bg-blue-500 text-white p-2 rounded-md flex items-center justify-center">
              <span className="mr-2">🚀</span> ADD
            </button>
            <button className="bg-blue-500 text-white p-2 rounded-md">CANCEL</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Task3;