
import "./Home.css";

const Home = ({ onStart }) => {
  return (
    <div className="home-screen">
      <div className="gambar-bg">
        <img src="/Awan.png" alt="awan" className="img-awan" />
        <img src="/Taman.jpeg" alt="taman" className="img-taman" />
        <img src="/Anak.png" alt="anak" className="img-anak" />
        <img src="/Mobil.png" alt="mobil" className="img-mobil" />
        <img src="/logo.png" alt="logo" className="img-logo" />
      </div>
      <div className="tombol-wrapper">
        <button className="btn-start" onClick={onStart}>
          START 
        </button>
      </div>
    </div>
  );
};

export default Home;